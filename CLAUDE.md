# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Google NotebookLM 비공식 API(`notebooklm-py`)를 활용한 문서 기반 AI 챗봇. FastAPI 백엔드(:8000) + Next.js 프론트엔드(:3000) 구조. 개인/프로토타입 용도.

## Commands

```bash
# Backend
cd backend && python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000    # Swagger: http://localhost:8000/docs

# Frontend
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
Browser (:3000) → Next.js Frontend → FastAPI Backend (:8000) → notebooklm-py → Google NotebookLM API
                                              ↓
                                     SQLite (chat history)
```

- **Backend** (`backend/app/`): FastAPI. 라우터(`api/`)가 Pydantic 모델로 요청/응답 처리, `services/notebooklm.py`가 NotebookLMClient 래핑
- **Frontend** (`frontend/src/`): Next.js 15 App Router. `lib/api.ts`가 모든 백엔드 호출 담당, `components/`에 UI 컴포넌트

## Key Patterns

- **Singleton services**: `NotebookLMClient`와 aiosqlite 연결 모두 모듈 레벨 전역 변수로 lazy init (`get_client()`, `get_db()`), FastAPI lifespan에서 cleanup
- **Source endpoints**: 소스 타입별 별도 엔드포인트 (`/sources/url`, `/sources/text`, `/sources/file`). 파일은 `data/uploads/`에 임시 저장 후 삭제
- **Chat history**: SQLite `chat_history` 테이블, `(notebook_id, conversation_id)` 키. user/assistant 메시지 모두 저장
- **Content generation**: `GENERATE_METHODS` dict가 문자열 타입명을 `client.artifacts.*` 메서드에 매핑 (audio, video, quiz, flashcards, summary, report, study_guide, infographic, slide_deck, data_table, mind_map)
- **Frontend API client**: `apiFetch<T>()` 제네릭 래퍼. base URL은 `NEXT_PUBLIC_API_URL` 환경변수 (기본값 `http://localhost:8000`)
- **CORS**: `localhost:3000`, `127.0.0.1:3000` 허용 (`backend/app/config.py`)

## API Endpoints

| Group | Endpoints |
|-------|-----------|
| Notebooks | `POST/GET /api/notebooks`, `GET/DELETE /api/notebooks/{id}` |
| Sources | `GET /api/notebooks/{id}/sources`, `POST .../sources/url\|text\|file`, `DELETE .../sources/{sid}` |
| Chat | `POST /api/notebooks/{id}/chat` (body: question, conversation_id?, source_ids?), `GET .../chat/history` |
| Generate | `POST /api/notebooks/{id}/generate/{type}`, `GET .../artifacts`, `GET .../artifacts/{aid}/download` |

## Adding a New Feature

1. Backend: service 함수 추가 (`services/notebooklm.py`) → 라우트 추가 (`api/`) → `main.py`에 라우터 등록
2. Frontend: API 함수 추가 (`lib/api.ts`) → 컴포넌트에서 호출 (try/catch + sonner toast)

## Important Notes

- **Next.js 버전 주의**: 이 프로젝트는 Next.js 16+를 사용하며 이전 버전과 breaking changes가 있음. 프론트엔드 수정 시 `node_modules/next/dist/docs/` 확인
- **비공식 API**: Google 내부 API 변경 시 동작 깨질 수 있음
- **인증 만료**: 쿠키 기반이므로 주기적으로 `notebooklm login` 재인증 필요
- **상태관리**: Redux/Zustand 없음. useState + useEffect로 충분한 규모
