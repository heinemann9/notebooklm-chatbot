# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Google NotebookLM 비공식 API(`notebooklm-py`)를 활용한 문서 기반 AI 챗봇. FastAPI 백엔드 + Next.js 프론트엔드 구조. 관리자(로그인) / 고객(공개 위젯) 두 가지 사용자 흐름. Docker 배포 시 포트 8100/3100, 로컬 개발 시 8000/3000.

## Commands

```bash
# Docker (권장)
docker compose up -d --build        # 실행 (3100/8100)
docker compose down                 # 종료

# Backend (로컬 개발)
cd backend && python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000    # Swagger: http://localhost:8000/docs

# Frontend (로컬 개발)
cd frontend && npm install
npm run dev       # http://localhost:3000
npm run build     # production build
npm run lint      # eslint

# NotebookLM Auth (prerequisite, 최초 1회)
pip install notebooklm-py && playwright install chromium
notebooklm login
notebooklm auth check --test
```

## Architecture

```
관리자 → Frontend (:3100) → Backend (:8100) → notebooklm-py → Google NotebookLM API
고객   → Frontend (/w/chat) ↗       ↓
                                SQLite (chat history)
```

- **Backend** (`backend/app/`): FastAPI. `main.py`에 인증 미들웨어(`/api/auth`, `/api/w/` 제외). 라우터(`api/`)가 Pydantic 모델로 요청/응답 처리
- **Frontend** (`frontend/src/`): Next.js App Router. `lib/api.ts`가 모든 백엔드 호출 담당, `components/`에 UI 컴포넌트
- **Auth flow**: `services/auth.py`가 Xvfb + Playwright로 브라우저 기반 Google 로그인 처리. 쿠키는 Docker 볼륨 `notebooklm-auth`에 저장
- **Widget**: `api/widget.py` + `frontend/src/app/w/` — 인증 불필요한 고객용 공개 채팅

## Key Patterns

- **Auth middleware**: `main.py`의 HTTP 미들웨어가 `/api/auth`, `/api/w/`, `/api/health`, `/docs` 외 모든 `/api/` 요청에 인증 체크
- **Singleton services**: `NotebookLMClient`와 aiosqlite 연결 모두 모듈 레벨 전역 변수로 lazy init (`get_client()`, `get_db()`), FastAPI lifespan에서 cleanup
- **Source endpoints**: 소스 타입별 별도 엔드포인트 (`/sources/url`, `/sources/file`). 파일은 `data/uploads/`에 임시 저장 후 삭제
- **Chat history**: SQLite `chat_history` 테이블, `(notebook_id, conversation_id)` 키. user/assistant 메시지 모두 저장
- **Widget config**: 환경변수 `WIDGET_TITLE`, `WIDGET_WELCOME_MESSAGE`, `WIDGET_NOTEBOOK_ID`로 고객 채팅 커스터마이징
- **Content generation**: `GENERATE_METHODS` dict가 문자열 타입명을 `client.artifacts.*` 메서드에 매핑
- **Frontend API client**: `apiFetch<T>()` 제네릭 래퍼. base URL은 `NEXT_PUBLIC_API_URL` 환경변수 (Docker: `http://localhost:8100`, 로컬: `http://localhost:8000`)
- **CORS**: `localhost:3000`, `localhost:3100` 및 `127.0.0.1` 변형 허용 (`backend/app/config.py`)

## API Endpoints

| Group | Endpoints |
|-------|-----------|
| Auth | `GET /api/auth/status`, `POST /api/auth/login`, `GET /api/auth/login/poll`, `POST /api/auth/logout` |
| Notebooks | `POST/GET /api/notebooks`, `DELETE /api/notebooks/{id}` |
| Sources | `GET /api/notebooks/{id}/sources`, `POST .../sources/url\|file`, `DELETE .../sources/{sid}` |
| Chat | `POST /api/notebooks/{id}/chat`, `GET .../chat/history` |
| Generate | `POST /api/notebooks/{id}/generate/{type}`, `GET .../artifacts`, `GET .../artifacts/{aid}/download` |
| Widget (공개) | `GET /api/w/config`, `POST /api/w/chat` |

## Adding a New Feature

1. Backend: service 함수 추가 (`services/`) → 라우트 추가 (`api/`) → `main.py`에 라우터 등록
2. Frontend: API 함수 추가 (`lib/api.ts`) → 컴포넌트에서 호출 (try/catch + sonner toast)
3. 인증이 필요없는 공개 API는 `api/widget.py`에 추가하고 `main.py` 미들웨어의 bypass 경로에 포함되는지 확인

## Workflow

### 워크플로우 오케스트레이션

1. **기본 계획 모드**: 사소하지 않은 모든 작업(3단계 이상 또는 아키텍처 결정 필요)에 대해 계획 모드 진입. 문제 발생 시 즉시 멈추고 재계획. 빌드뿐 아니라 검증 단계에서도 계획 모드 사용. 모호함을 줄이기 위해 사전에 상세한 사양 작성
2. **서브 에이전트 전략**: 메인 컨텍스트 윈도우를 깨끗하게 유지하기 위해 서브 에이전트 자유롭게 사용. 조사/탐색/병렬 분석 작업 위임. 서브 에이전트당 하나의 작업 할당
3. **자기 개선 루프**: 사용자로부터 수정을 받으면 반드시 `tasks/lessons.md`에 패턴 업데이트. 같은 실수 반복 방지를 위한 규칙 작성. 세션 시작 시 교훈 검토
4. **완료 전 검증**: 작동 증명 없이 완료 표시 금지. "스태프 엔지니어가 승인할까?" 자문. 테스트 실행, 로그 확인, 정확성 입증
5. **우아함 추구**: 사소하지 않은 변경은 "더 우아한 방법이 없을까?" 자문. 간단한 수정에는 건너뛰기 — 과도한 엔지니어링 금지. 제시 전 비판적 검토
6. **자율적 버그 수정**: 버그 리포트 받으면 직접 수정. 불필요한 질문 금지. 실패한 CI 테스트도 지시 없이 수정

### 작업 관리

1. `tasks/todo.md`에 체크 가능한 항목으로 계획 작성 → 확인 후 구현 시작
2. 진행하면서 완료 항목 표시 + 각 단계에서 높은 수준의 요약 제공
3. `tasks/todo.md`에 검토 섹션 추가, 수정 사항 있으면 `tasks/lessons.md` 업데이트

### 핵심 원칙

- **단순함 우선**: 모든 변경을 가능한 한 단순하게. 코드 영향 최소화
- **나태함 금지**: 근본 원인 해결. 임시방편 안 됨. 시니어 개발자 수준의 기준
- **최소한의 영향**: 필요한 부분만 변경. 버그 유입 방지

## Git Conventions

- **Co-Authored-By 금지**: 커밋 메시지에 `Co-Authored-By` 라인을 포함하지 않는다

## Important Notes

- **Next.js 버전 주의**: 이 프로젝트는 Next.js 16+를 사용하며 이전 버전과 breaking changes가 있음. 프론트엔드 수정 시 `node_modules/next/dist/docs/` 확인
- **비공식 API**: Google 내부 API 변경 시 동작 깨질 수 있음
- **인증 만료**: Docker 볼륨의 쿠키 기반이므로 주기적으로 `/login`에서 재인증 필요
- **상태관리**: Redux/Zustand 없음. useState + useEffect로 충분한 규모
- **Docker 포트**: 외부 포트 3100(FE)/8100(BE), 컨테이너 내부 3000/8000
