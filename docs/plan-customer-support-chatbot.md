# plan- 고객 지원 챗봇 (공개 채팅 페이지)

## Context

NotebookLM에 업로드한 회사 문서를 기반으로, 고객이 인증 없이 접속하여 질문할 수 있는 공개 채팅 페이지를 만든다. 관리자는 기존 UI에서 노트북/소스를 관리하고, 고객은 공유된 링크로 채팅만 한다.

---

## 핵심 결정 사항

**설정 관리 수준**: 아래 3가지 중 선택 필요

| 옵션 | 설명 | 작업량 |
|------|------|--------|
| **A. 최소 (env/config)** | 노트북 ID를 환경변수로 지정. 별도 관리 UI 없음. 공개 페이지만 구현. | 작음 |
| **B. 간단한 설정** | 관리자 UI에 노트북 선택 + 환영 메시지 정도만 설정하는 페이지 추가 | 중간 |
| **C. 풀 관리** | 여러 위젯 CRUD, 브랜딩, 색상, 슬러그 관리 등 풀 패널 | 큼 |

> **추천: 옵션 A로 시작** — 최소한으로 빠르게 동작하는 버전을 만든 후, 필요에 따라 B → C로 확장.

---

## 구현 계획 (옵션 A 기준)

### Architecture

```
고객 브라우저 → /w/chat (공개 페이지, 인증 불필요)
                  ↓
            POST /api/w/chat → ask_notebook(NOTEBOOK_ID, question)
                  ↓
            NotebookLM API → 답변 반환
```

관리자는 기존 UI(`/`)에서 노트북에 소스를 추가/관리.
고객은 `/w/chat`에서 질문만.

---

### Phase 1: Backend — 공개 채팅 API

#### 1-1. `backend/app/config.py` (MODIFY)

환경변수로 위젯 설정 관리:

```python
import os

WIDGET_NOTEBOOK_ID = os.environ.get("WIDGET_NOTEBOOK_ID", "")
WIDGET_TITLE = os.environ.get("WIDGET_TITLE", "Support")
WIDGET_WELCOME_MESSAGE = os.environ.get("WIDGET_WELCOME_MESSAGE", "안녕하세요! 무엇을 도와드릴까요?")
```

#### 1-2. `backend/app/api/widget.py` (NEW)

| Endpoint | Method | 인증 | 설명 |
|----------|--------|------|------|
| `/api/w/config` | GET | 불필요 | 위젯 설정 반환 (title, welcome_message) |
| `/api/w/chat` | POST | 불필요 | 고객 질문 → NotebookLM 답변 |

- `POST /api/w/chat` body: `{ question: string, conversation_id?: string }`
- 내부에서 `ask_notebook(WIDGET_NOTEBOOK_ID, question, conversation_id)` 호출
- 응답: `{ answer: string, conversation_id: string }`

#### 1-3. `backend/app/main.py` (MODIFY)

- widget 라우터 등록: `app.include_router(widget.router)`
- auth middleware에 `/api/w/` 경로 예외 추가

---

### Phase 2: Frontend — 공개 채팅 페이지

#### 2-1. `frontend/src/app/w/chat/page.tsx` (NEW)

- **인증 가드 없음** (useAuthGuard 사용 안 함)
- 페이지 로드 시 `GET /api/w/config`로 설정 가져오기
- 환영 메시지를 AI 첫 메시지로 표시
- 채팅 입력 → `POST /api/w/chat` → 응답 표시
- conversation_id를 state로 관리 (새로고침 시 리셋)
- 디자인: 기존 neutral/minimal 톤, 헤더에 위젯 타이틀만 표시

#### 2-2. `frontend/src/lib/api.ts` (MODIFY)

```typescript
// 위젯 (공개) API — 인증 불필요
export function getWidgetConfig(): Promise<WidgetConfig>
export function sendWidgetMessage(question: string, conversationId?: string): Promise<ChatResponse>
```

---

### Phase 3: (선택) 관리자 UI 개선

- NotebookList에 "공개 채팅 링크 복사" 버튼 추가
- 현재 위젯으로 설정된 노트북 표시

---

## 파일 변경 요약

| 파일 | 작업 | 설명 |
|------|------|------|
| `backend/app/config.py` | MODIFY | WIDGET_* 환경변수 추가 |
| `backend/app/api/widget.py` | NEW | 공개 채팅 API (2개 엔드포인트) |
| `backend/app/main.py` | MODIFY | 라우터 등록 + auth 예외 |
| `frontend/src/app/w/chat/page.tsx` | NEW | 공개 채팅 페이지 |
| `frontend/src/lib/api.ts` | MODIFY | 위젯 API 함수 추가 |

---

## 사용 흐름

```
[관리자]
1. 기존 UI에서 노트북 생성 + 회사 문서 업로드
2. 해당 노트북 ID 확인
3. WIDGET_NOTEBOOK_ID=xxx 로 서버 시작
4. 고객에게 https://도메인/w/chat 링크 공유

[고객]
1. 링크 접속 → 환영 메시지 표시
2. 질문 입력 → 회사 문서 기반 AI 답변
3. 이어서 추가 질문 가능 (같은 세션 내)
```

---

## Verification

1. `WIDGET_NOTEBOOK_ID=xxx uvicorn app.main:app` 으로 서버 시작
2. `curl localhost:8000/api/w/config` → 설정 반환 확인 (인증 없이)
3. `curl -X POST localhost:8000/api/w/chat -d '{"question":"test"}'` → 답변 확인
4. `http://localhost:3000/w/chat` → 공개 채팅 페이지 동작 확인
5. `http://localhost:3000/` → 여전히 로그인 필요 확인 (기존 기능 영향 없음)

---

## 향후 확장 (옵션 B/C)

- SQLite `widgets` 테이블로 멀티 위젯 지원
- 관리자 UI에서 위젯 생성/수정/삭제
- 위젯별 slug (`/w/{slug}`)
- 브랜딩 (로고, 색상, 폰트)
- 고객 대화 로그 저장 + 관리자 모니터링
- Rate limiting
