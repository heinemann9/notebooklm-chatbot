# NotebookLM Chatbot

Google NotebookLM 비공식 API(`notebooklm-py`)를 활용한 문서 기반 AI 챗봇 서비스.
관리자가 노트북/소스를 관리하고, 고객에게 공개 채팅 링크를 공유하는 구조.

## 서비스 구조

```
관리자 → Frontend (:3100) → Backend (:8100) → NotebookLM API
고객   → Frontend (/w/chat) ↗       ↓
                                SQLite (chat history)
```

- **관리자**: 로그인 후 노트북 생성, 소스 추가, 채팅, 콘텐츠 생성
- **고객**: 인증 없이 `/w/chat`에서 주제 선택 후 채팅

## 실행 방법

### Docker 실행 (권장)

```bash
docker compose up -d --build
```

| 서비스 | URL |
|--------|-----|
| 프론트엔드 | http://localhost:3100 |
| 백엔드 API | http://localhost:8100 |
| API 문서 (Swagger) | http://localhost:8100/docs |

```bash
docker compose down              # 종료
docker compose logs -f backend   # 백엔드 로그
docker compose logs -f frontend  # 프론트엔드 로그
```

### 로컬 실행 (개발용)

#### 사전 요구사항

- Python 3.12+
- Node.js 18+
- Google 계정 (NotebookLM 인증용)

#### 1. NotebookLM 인증 (최초 1회)

```bash
pip install notebooklm-py
playwright install chromium
notebooklm login
notebooklm auth check --test
```

#### 2. 백엔드 (FastAPI, :8000)

```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

#### 3. 프론트엔드 (Next.js, :3000)

```bash
cd frontend
npm install
npm run dev
```

## 페이지 목록

### 관리자 페이지 (로그인 필요)

| URL | 설명 |
|-----|------|
| `/` | 노트북 목록 (생성/삭제) |
| `/login` | Google 로그인 |
| `/chat/{노트북ID}` | 노트북 채팅 + 소스 관리 |

### 고객 페이지 (로그인 불필요)

| URL | 설명 |
|-----|------|
| `/w/chat` | 공개 채팅 (주제 선택 → 채팅) |

## 사용 방법

1. `/login`에서 Google 계정 로그인
2. 메인 페이지에서 **노트북 생성**
3. 노트북에 **소스 추가** (URL, 파일 업로드)
4. 소스 기반으로 **관리자 채팅** 테스트
5. 고객에게 `/w/chat` 링크 공유

## 환경변수

`docker-compose.yml` 또는 `.env` 파일에서 설정:

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `WIDGET_TITLE` | `Support` | 고객 채팅 페이지 타이틀 |
| `WIDGET_WELCOME_MESSAGE` | `안녕하세요! 무엇을 도와드릴까요?` | 고객 채팅 첫 메시지 |
| `WIDGET_NOTEBOOK_ID` | (없음) | 특정 노트북 고정 시 사용 |

## API 엔드포인트

### 인증 API

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/auth/status` | 인증 상태 확인 |
| POST | `/api/auth/login` | 로그인 세션 시작 |
| GET | `/api/auth/login/poll` | 로그인 완료 폴링 |
| POST | `/api/auth/logout` | 로그아웃 |

### 관리자 API (인증 필요)

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET/POST | `/api/notebooks` | 노트북 목록/생성 |
| DELETE | `/api/notebooks/{id}` | 노트북 삭제 |
| GET | `/api/notebooks/{id}/sources` | 소스 목록 |
| POST | `/api/notebooks/{id}/sources/url` | URL 소스 추가 |
| POST | `/api/notebooks/{id}/sources/file` | 파일 소스 추가 |
| DELETE | `/api/notebooks/{id}/sources/{sid}` | 소스 삭제 |
| POST | `/api/notebooks/{id}/chat` | 관리자 채팅 |
| GET | `/api/notebooks/{id}/chat/history` | 채팅 히스토리 |
| POST | `/api/notebooks/{id}/generate/{type}` | 콘텐츠 생성 |
| GET | `/api/notebooks/{id}/artifacts` | 아티팩트 목록 |

### 고객 API (인증 불필요)

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/w/config` | 위젯 설정 + 노트북 목록 |
| POST | `/api/w/chat` | 고객 채팅 |

## 프로젝트 구조

```
notebooklm-chatbot/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI 엔트리포인트 + 인증 미들웨어
│   │   ├── config.py            # 설정 (CORS, 위젯 환경변수)
│   │   ├── database.py          # SQLite 대화 이력
│   │   ├── api/
│   │   │   ├── auth.py          # 인증 (Google 로그인)
│   │   │   ├── notebooks.py     # 노트북 CRUD
│   │   │   ├── sources.py       # 소스 관리
│   │   │   ├── chat.py          # 챗봇 질의응답
│   │   │   ├── generate.py      # 콘텐츠 생성
│   │   │   └── widget.py        # 고객 위젯 API
│   │   └── services/
│   │       ├── notebooklm.py    # NotebookLMClient 래퍼
│   │       └── auth.py          # 인증 서비스 (Playwright)
│   ├── requirements.txt
│   └── data/                    # SQLite DB, 업로드 파일
│
├── frontend/
│   ├── src/app/
│   │   ├── page.tsx             # 메인 (노트북 목록)
│   │   ├── login/page.tsx       # Google 로그인
│   │   ├── chat/[id]/page.tsx   # 관리자 채팅
│   │   └── w/chat/page.tsx      # 고객 채팅 위젯
│   ├── src/components/          # UI 컴포넌트
│   ├── src/lib/api.ts           # API 클라이언트
│   └── package.json
│
├── docker-compose.yml
├── docs/service-guide.md        # 서비스 상세 가이드
└── README.md
```

## 주의사항

- **비공식 API**: Google 내부 API 변경 시 동작이 깨질 수 있습니다.
- **인증 쿠키**: Docker 볼륨 `notebooklm-auth`에 저장. 주기적으로 만료되므로 재로그인 필요.
- **고객 채팅 히스토리**: 브라우저 세션 내에서만 유지. 새로고침 시 리셋.
- **Rate Limit**: 과도한 요청 시 Google에 의해 제한될 수 있습니다.
- **개인/프로토타입 용도**: 프로덕션 서비스에는 부적합합니다.
