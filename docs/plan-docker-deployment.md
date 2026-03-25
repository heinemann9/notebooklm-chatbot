# plan- Docker 배포 구성

## Context

현재 백엔드(`uvicorn`)와 프론트엔드(`npm run dev`)를 각각 수동 실행하고 있다. Docker Compose로 묶어서 한 번에 띄우고, 환경변수(WIDGET_NOTEBOOK_ID 등)도 깔끔하게 관리한다.

---

## 구조

```
docker-compose.yml
├── backend   (FastAPI + Playwright + Chromium + Xvfb)
├── frontend  (Next.js)
└── volumes
    ├── ./backend/data/        → 컨테이너 내 /app/data (SQLite, uploads)
    └── notebooklm-auth        → /root/.notebooklm (인증 쿠키)
```

---

## 인증 전략: Xvfb + WebSocket 리모트 브라우저

Docker 컨테이너에는 물리 디스플레이가 없으므로, **Xvfb(가상 디스플레이)**를 사용하여 `headless=False` 브라우저를 실행한다. 사용자는 웹 UI에서 스크린샷 스트리밍을 통해 Google 로그인을 완료한다.

```
[웹 UI /login]                [Backend 컨테이너]
 ┌──────────┐                 ┌──────────────────────┐
 │ <canvas>  │◄── WS 스크린샷 ──│  Playwright           │
 │ 클릭/키 입력│── WS 전달 ──►│  headless=False       │
 └──────────┘                 │       ↕               │
                              │  Xvfb :99 (가상 디스플레이)│
                              │       ↕               │
                              │  Chromium (진짜 브라우저) │
                              └──────────────────────┘
```

**핵심:**
- Xvfb가 가상 모니터를 제공 → Chromium은 `headless=False`로 실행 가능
- Google은 진짜 브라우저로 인식 → 봇 감지 우회
- WebSocket으로 스크린샷 전송 + 입력 릴레이 → 웹 UI에서 로그인

---

## 파일 계획

### 1. `backend/Dockerfile`

```dockerfile
FROM python:3.12-slim

WORKDIR /app

# Xvfb + Playwright 시스템 의존성
RUN apt-get update && apt-get install -y \
    xvfb \
    libnss3 libatk-bridge2.0-0 libdrm2 libxcomposite1 \
    libxdamage1 libxrandr2 libgbm1 libpango-1.0-0 \
    libasound2 libxshmfence1 libx11-xcb1 libxcb1 \
    libxext6 libxfixes3 libxi6 libxrender1 libxtst6 \
    fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN playwright install chromium

COPY . .

EXPOSE 8000

# Xvfb 시작 후 uvicorn 실행
CMD ["sh", "-c", "Xvfb :99 -screen 0 1280x800x24 -nolisten tcp &  DISPLAY=:99 uvicorn app.main:app --host 0.0.0.0 --port 8000"]
```

**포인트:**
- `xvfb`: 가상 디스플레이 서버
- `fonts-noto-cjk`: 한글/일본어/중국어 폰트 (Google 로그인 페이지 렌더링용)
- `DISPLAY=:99`: Playwright가 가상 디스플레이 사용하도록 설정
- CMD에서 Xvfb를 백그라운드로 먼저 시작, 이후 uvicorn 실행

### 2. `frontend/Dockerfile`

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

### 3. `docker-compose.yml` (프로젝트 루트)

```yaml
services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - WIDGET_NOTEBOOK_ID=${WIDGET_NOTEBOOK_ID:-}
      - WIDGET_TITLE=${WIDGET_TITLE:-Support}
      - WIDGET_WELCOME_MESSAGE=${WIDGET_WELCOME_MESSAGE:-안녕하세요! 무엇을 도와드릴까요?}
    volumes:
      - ./backend/data:/app/data
      - notebooklm-auth:/root/.notebooklm
    restart: unless-stopped

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:8000
    depends_on:
      - backend
    restart: unless-stopped

volumes:
  notebooklm-auth:
```

### 4. `.env` (프로젝트 루트, gitignore 대상)

```env
WIDGET_NOTEBOOK_ID=your-notebook-id-here
WIDGET_TITLE=고객지원
WIDGET_WELCOME_MESSAGE=안녕하세요! 무엇을 도와드릴까요?
```

### 5. `.dockerignore` (backend/, frontend/ 각각)

**backend/.dockerignore:**
```
venv/
__pycache__/
data/
*.pyc
.env
```

**frontend/.dockerignore:**
```
node_modules/
.next/
.env
```

---

## 코드 변경 필요 사항

### `backend/app/services/auth.py` — LoginSession 수정

현재 로컬 전용(headful + 데스크톱 표시)과 Docker용(Xvfb + WebSocket 스크린샷) 두 모드를 지원해야 한다.

**방안: 환경 감지 자동 전환**

```python
import os

def _has_display() -> bool:
    """물리 디스플레이 또는 Xvfb가 있는지 확인"""
    return bool(os.environ.get("DISPLAY"))
```

- `DISPLAY` 환경변수 존재 (Xvfb or 로컬 데스크톱) → `headless=False`
- `DISPLAY` 없음 → `headless=False` 불가 → fallback으로 `headless=True` 시도

Docker에서는 CMD에서 `DISPLAY=:99`를 설정하므로, 항상 `headless=False`로 동작.

### `backend/app/api/auth.py` — WebSocket 로그인 복원

이전에 만들었던 WebSocket 스크린샷 스트리밍 + 입력 릴레이 방식을 복원한다.
현재 폴링 방식(POST /login + GET /login/poll)과 **병행** 지원:

| 엔드포인트 | 사용 환경 |
|-----------|----------|
| `POST /api/auth/login` + `GET /api/auth/login/poll` | 로컬 (데스크톱에 브라우저 창 표시) |
| `WebSocket /api/auth/login/ws` | Docker (Xvfb + 스크린샷 스트리밍) |

프론트엔드는 `/api/auth/status` 응답에 `has_display` 필드를 포함시켜, 어떤 모드를 사용할지 결정:
- `has_display: true` + 로컬 → 폴링 모드 (기존)
- `has_display: false` 또는 Docker → WebSocket 모드 (스크린샷)

### 프론트엔드 — RemoteBrowser 컴포넌트 복원

이전에 삭제한 `RemoteBrowser.tsx`(Canvas + WebSocket)를 복원하여, Docker 환경에서 로그인 UI로 사용.

---

## 실행

```bash
# 빌드 + 실행
docker compose up -d --build

# 로그 확인
docker compose logs -f backend
docker compose logs -f frontend

# 중지
docker compose down

# 재빌드
docker compose up -d --build
```

---

## 로그인 흐름 (Docker)

1. `http://localhost:3000` 접속 → `/login` 리다이렉트
2. "Login with Google" 클릭
3. WebSocket 연결 → 백엔드가 Xvfb 위에서 Chromium 실행
4. 웹 UI의 Canvas에 Google 로그인 화면 표시 (스크린샷 스트리밍)
5. 사용자가 Canvas 클릭/키보드로 Google 로그인 완료
6. 로그인 감지 → 쿠키 저장 → 메인 페이지로 이동

---

## CORS 설정

Docker 환경에서 프론트엔드(`localhost:3000`) → 백엔드(`localhost:8000`) 호출. 현재 CORS 설정으로 동작. 프로덕션 도메인 사용 시 `CORS_ORIGINS`에 추가 필요.

---

## 향후 개선

- **Nginx 리버스 프록시**: 프론트/백을 하나의 포트(80/443)로 통합
- **HTTPS**: Let's Encrypt + Nginx 또는 Cloudflare Tunnel
- **Health check**: docker-compose에 healthcheck 추가
- **멀티 스테이지 빌드**: 이미지 사이즈 최적화
- **GitHub Actions**: push 시 자동 빌드/배포
