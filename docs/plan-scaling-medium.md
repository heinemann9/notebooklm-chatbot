# 중규모 스케일링 설계 문서

> 목표: 공개 위젯(`/w/chat`) 동시 50~100명 수준의 안정적 서비스

## 1. 현재 구조의 병목 분석

| 병목 지점 | 현재 상태 | 문제 |
|-----------|-----------|------|
| NotebookLMClient | 싱글톤 1개 | 모든 요청이 하나의 클라이언트를 공유 |
| Google API rate limit | 계정 1개 | 비공식 API, 계정당 제한 불명확 |
| SQLite | 단일 파일 DB | 쓰기 잠금(WAL 미적용 시 동시 쓰기 불가) |
| uvicorn | 단일 워커 | CPU 바운드 작업 시 블로킹 |
| Docker 구성 | 단일 컨테이너 | 수평 확장 불가 |

## 2. 클라이언트 풀 도입

### 2.1 구조

싱글톤 `_client` 대신 여러 클라이언트를 풀로 관리한다.

```python
# backend/app/services/client_pool.py

import asyncio
from notebooklm import NotebookLMClient

class ClientPool:
    def __init__(self, pool_size: int = 5):
        self._pool_size = pool_size
        self._semaphore = asyncio.Semaphore(pool_size)
        self._clients: list[NotebookLMClient] = []
        self._available: asyncio.Queue[NotebookLMClient] = asyncio.Queue()
        self._initialized = False

    async def initialize(self):
        """서버 시작 시 풀 초기화"""
        if self._initialized:
            return
        for _ in range(self._pool_size):
            client = await NotebookLMClient.from_storage()
            client = await client.__aenter__()
            self._clients.append(client)
            await self._available.put(client)
        self._initialized = True

    async def acquire(self) -> NotebookLMClient:
        """풀에서 클라이언트 1개 대여 (없으면 대기)"""
        await self._semaphore.acquire()
        return await self._available.get()

    async def release(self, client: NotebookLMClient):
        """사용 완료된 클라이언트 반환"""
        await self._available.put(client)
        self._semaphore.release()

    async def close(self):
        for client in self._clients:
            await client.__aexit__(None, None, None)
        self._clients.clear()
        self._initialized = False


# 전역 풀 인스턴스
pool = ClientPool(pool_size=int(os.environ.get("CLIENT_POOL_SIZE", "5")))
```

### 2.2 사용 패턴

```python
# backend/app/services/notebooklm.py 수정

from .client_pool import pool

async def ask_notebook(notebook_id, question, conversation_id=None, source_ids=None):
    client = await pool.acquire()
    try:
        return await client.chat.ask(
            notebook_id, question,
            source_ids=source_ids,
            conversation_id=conversation_id,
        )
    finally:
        await pool.release(client)
```

### 2.3 주의사항

- `NotebookLMClient.from_storage()`는 동일 쿠키 파일을 읽으므로, 하나의 Google 계정에서 여러 세션을 열어도 되는지 확인 필요
- Google 측에서 동일 계정의 동시 요청을 차단할 수 있음 -> 이 경우 **다중 계정** 전략 필요

## 3. 요청 큐 + 동시성 제한 (Semaphore)

클라이언트 풀 없이도 동시성을 제어하는 가벼운 방법.

```python
# backend/app/services/rate_limiter.py

import asyncio
from fastapi import HTTPException

# 동시 처리 가능한 채팅 요청 수
_chat_semaphore = asyncio.Semaphore(int(os.environ.get("MAX_CONCURRENT_CHATS", "10")))

# 대기열 최대 길이
_MAX_QUEUE = int(os.environ.get("MAX_CHAT_QUEUE", "50"))
_waiting = 0

async def rate_limited_chat(func, *args, **kwargs):
    global _waiting
    if _waiting >= _MAX_QUEUE:
        raise HTTPException(
            status_code=503,
            detail="현재 요청이 많습니다. 잠시 후 다시 시도해주세요."
        )
    _waiting += 1
    try:
        async with _chat_semaphore:
            return await func(*args, **kwargs)
    finally:
        _waiting -= 1
```

### widget.py 적용

```python
@router.post("/chat")
async def widget_chat(req: WidgetChatRequest):
    result = await rate_limited_chat(
        ask_notebook, req.notebook_id, req.question,
        conversation_id=req.conversation_id,
    )
    return {"answer": result.answer, "conversation_id": result.conversation_id}
```

## 4. 응답 캐싱

동일 notebook + 동일 질문에 대한 중복 요청을 줄인다.

```python
# backend/app/services/cache.py

import hashlib
import time
from typing import Optional

_cache: dict[str, tuple[float, dict]] = {}
CACHE_TTL = int(os.environ.get("CHAT_CACHE_TTL", "300"))  # 5분

def cache_key(notebook_id: str, question: str) -> str:
    raw = f"{notebook_id}:{question.strip().lower()}"
    return hashlib.sha256(raw.encode()).hexdigest()

def get_cached(notebook_id: str, question: str) -> Optional[dict]:
    key = cache_key(notebook_id, question)
    if key in _cache:
        ts, data = _cache[key]
        if time.time() - ts < CACHE_TTL:
            return data
        del _cache[key]
    return None

def set_cached(notebook_id: str, question: str, data: dict):
    key = cache_key(notebook_id, question)
    _cache[key] = (time.time(), data)
```

## 5. SQLite 최적화 (채팅 기록 저장 시)

```python
# database.py 초기화 시 추가
await db.execute("PRAGMA journal_mode=WAL")      # 읽기/쓰기 동시 허용
await db.execute("PRAGMA synchronous=NORMAL")     # 쓰기 성능 향상
await db.execute("PRAGMA busy_timeout=5000")      # 잠금 대기 5초
```

위젯 채팅이 DB에 기록을 저장하지 않더라도, 관리자 채팅과 동시에 사용될 때 도움이 된다.

## 6. Docker 수평 확장 (replicas + Nginx 로드밸런서)

uvicorn 멀티 워커 대신, **Docker 컨테이너를 여러 개 띄우고 Nginx로 분배**하는 것이 Docker 환경의 정석이다.

- 컨테이너 단위 장애 격리 (하나가 죽어도 나머지 정상)
- `docker compose`로 간단히 스케일 조정
- 컨테이너별 독립 프로세스 → 메모리 누수/크래시 영향 최소화

### 6.1 docker-compose.yml 수정

```yaml
services:
  nginx:
    image: nginx:alpine
    ports:
      - "8100:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - backend
    restart: unless-stopped

  backend:
    build: ./backend
    # ports 제거 — Nginx가 프록시하므로 외부 노출 불필요
    expose:
      - "8000"
    environment:
      - WIDGET_NOTEBOOK_ID=${WIDGET_NOTEBOOK_ID:-}
      - WIDGET_TITLE=${WIDGET_TITLE:-Support}
      - WIDGET_WELCOME_MESSAGE=${WIDGET_WELCOME_MESSAGE:-안녕하세요! 무엇을 도와드릴까요?}
      - ADMIN_PASSWORD=${ADMIN_PASSWORD:-skqldi25}
      - CLIENT_POOL_SIZE=3
      - MAX_CONCURRENT_CHATS=10
      - MAX_CHAT_QUEUE=50
    volumes:
      - ./backend/data:/app/data
      - notebooklm-auth:/root/.notebooklm
    deploy:
      replicas: 4                    # 백엔드 컨테이너 4개
    restart: unless-stopped

  frontend:
    build:
      context: ./frontend
      args:
        NEXT_PUBLIC_API_URL: http://172.30.1.83:8100
    ports:
      - "3100:3000"
    depends_on:
      - nginx
    restart: unless-stopped

volumes:
  notebooklm-auth:
```

### 6.2 nginx.conf (프로젝트 루트에 추가)

```nginx
events {
    worker_connections 1024;
}

http {
    upstream backend {
        # Docker Compose가 replicas의 각 컨테이너를 DNS로 자동 등록
        server backend:8000;
    }

    server {
        listen 80;

        location / {
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

            # 채팅 응답 대기가 길 수 있으므로 타임아웃 여유 확보
            proxy_read_timeout 120s;
            proxy_send_timeout 120s;
        }
    }
}
```

### 6.3 Docker DNS 라운드로빈

`docker compose`에서 `replicas: 4`로 설정하면, `backend`라는 DNS 이름에 4개 컨테이너 IP가 등록된다.
Nginx `upstream`이 이를 자동으로 라운드로빈 분배한다.

### 6.4 스케일 조정 명령어

```bash
# 실행 중에도 컨테이너 수 조정 가능
docker compose up -d --scale backend=6

# 현재 상태 확인
docker compose ps
```

> **주의**: 각 컨테이너가 독립된 클라이언트 풀을 가짐.
> 컨테이너 4개 x 풀 3개 = 최대 12개 동시 Google API 호출.
> SQLite는 파일 잠금으로 컨테이너 간 동기화되지만, 쓰기 빈도가 높으면 PostgreSQL 전환 고려.

## 7. 프론트엔드 보호

### 7.1 요청 쓰로틀링 (프론트엔드)

```typescript
// frontend/src/lib/throttle.ts
// 사용자당 최소 2초 간격으로 메시지 전송 제한
let lastSent = 0;
export function canSend(): boolean {
  const now = Date.now();
  if (now - lastSent < 2000) return false;
  lastSent = now;
  return true;
}
```

### 7.2 503 응답 처리

```typescript
// 서버가 503을 반환하면 사용자에게 안내
if (response.status === 503) {
  toast.error("현재 이용자가 많습니다. 잠시 후 다시 시도해주세요.");
  return;
}
```

## 8. 모니터링 엔드포인트

```python
# backend/app/main.py 에 추가

@app.get("/api/health/detail")
async def health_detail():
    from .services.rate_limiter import _waiting, _chat_semaphore
    from .services.client_pool import pool
    return {
        "status": "ok",
        "pool_size": pool._pool_size,
        "pool_available": pool._available.qsize(),
        "chat_waiting": _waiting,
        "semaphore_available": _chat_semaphore._value,
    }
```

## 9. 적용 우선순위

| 순서 | 항목 | 난이도 | 효과 |
|------|------|--------|------|
| 1 | Semaphore 동시성 제한 | 낮음 | 서버 과부하 방지 |
| 2 | 503 응답 + 프론트 쓰로틀링 | 낮음 | 사용자 경험 보호 |
| 3 | SQLite WAL 모드 | 낮음 | DB 병목 해소 |
| 4 | 응답 캐싱 | 중간 | 중복 요청 감소 |
| 5 | 클라이언트 풀 | 중간 | 동시 처리량 증가 |
| 6 | Docker replicas + Nginx | 중간 | 수평 확장 + 장애 격리 |
| 7 | 모니터링 엔드포인트 | 낮음 | 운영 가시성 확보 |

## 10. 예상 수용량

| 구성 | 동시 채팅 | 비고 |
|------|-----------|------|
| 현재 (싱글톤) | ~5명 | 응답 지연 누적 |
| Semaphore + 캐시 | ~20명 | 중복 질문 캐시 히트 시 더 높음 |
| 클라이언트 풀(3) + Docker 4 replicas | ~50명 | Google API 허용 범위 내 |
| 다중 계정 + 풀 | ~100명 | 계정당 풀 분리 운영 |

> 실제 수용량은 Google NotebookLM API의 응답 시간과 rate limit에 크게 좌우된다.
> 비공식 API이므로 부하 테스트 후 수치를 조정할 것.
