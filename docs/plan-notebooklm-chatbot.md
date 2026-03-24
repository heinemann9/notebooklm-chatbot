# NotebookLM 챗봇 프로젝트 계획서

## 1. 프로젝트 개요

Google NotebookLM의 비공식 Python API(`notebooklm-py`)를 활용하여 문서 기반 AI 챗봇을 구축한다.
사용자가 문서(PDF, URL, 텍스트 등)를 업로드하면 NotebookLM에 소스로 등록하고,
해당 소스를 기반으로 질의응답할 수 있는 웹 챗봇 서비스를 제공한다.

## 2. 핵심 기능

| 기능 | 설명 |
|------|------|
| 문서 업로드 | PDF, URL, YouTube, 텍스트 파일을 소스로 등록 |
| 챗봇 대화 | 등록된 소스 기반 질의응답 (NotebookLM Chat API) |
| 대화 이력 | 대화 히스토리 저장 및 조회 |
| 콘텐츠 생성 | 오디오 오버뷰, 퀴즈, 요약 등 NotebookLM 생성 기능 활용 |
| 노트북 관리 | 노트북 생성/삭제/목록 조회 |

## 3. 기술 스택

| 구분 | 기술 |
|------|------|
| **백엔드** | Python 3.12, FastAPI, notebooklm-py (0.3.4) |
| **프론트엔드** | Next.js 15 (App Router), TypeScript, Tailwind CSS, shadcn/ui |
| **인증** | notebooklm-py 내장 Google 인증 (브라우저 로그인 → 쿠키 저장) |
| **데이터 저장** | SQLite (대화 이력, 노트북 매핑) 또는 JSON 파일 |
| **실행 환경** | Mac Mini M4 Pro (Apple Silicon) |

## 4. 아키텍처

```
사용자 (브라우저)
    │
    ▼
Next.js (프론트엔드, :3000)
    │
    ▼
FastAPI (백엔드 API, :8000)
    ├── POST /api/notebooks          → 노트북 생성
    ├── POST /api/sources            → 소스 추가 (파일/URL)
    ├── POST /api/chat               → 질문 → NotebookLM Chat API → 답변
    ├── GET  /api/chat/history       → 대화 이력 조회
    ├── POST /api/generate/{type}    → 콘텐츠 생성 (audio, quiz 등)
    └── GET  /api/notebooks          → 노트북 목록
    │
    ▼
notebooklm-py (NotebookLMClient)
    │
    ▼
Google NotebookLM (비공식 API)
```

## 5. API 설계

### 노트북 관리
```
POST   /api/notebooks              → 노트북 생성
GET    /api/notebooks              → 노트북 목록
DELETE /api/notebooks/{id}         → 노트북 삭제
```

### 소스 관리
```
POST   /api/notebooks/{id}/sources → 소스 추가 (URL, 파일 업로드)
GET    /api/notebooks/{id}/sources → 소스 목록
DELETE /api/notebooks/{id}/sources/{source_id} → 소스 삭제
```

### 챗봇
```
POST   /api/notebooks/{id}/chat    → 질문 전송 및 답변 수신
GET    /api/notebooks/{id}/chat/history → 대화 이력
```

### 콘텐츠 생성
```
POST   /api/notebooks/{id}/generate/audio      → 오디오 오버뷰 생성
POST   /api/notebooks/{id}/generate/quiz       → 퀴즈 생성
POST   /api/notebooks/{id}/generate/summary    → 요약 리포트 생성
GET    /api/notebooks/{id}/artifacts            → 생성된 콘텐츠 목록
GET    /api/notebooks/{id}/artifacts/{aid}/download → 다운로드
```

## 6. 디렉토리 구조 (예정)

```
notebooklm-chatbot/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI 엔트리포인트
│   │   ├── config.py            # 설정
│   │   ├── api/
│   │   │   ├── notebooks.py     # 노트북 라우트
│   │   │   ├── sources.py       # 소스 라우트
│   │   │   ├── chat.py          # 챗봇 라우트
│   │   │   └── generate.py      # 콘텐츠 생성 라우트
│   │   └── services/
│   │       └── notebooklm.py    # NotebookLMClient 래퍼
│   ├── requirements.txt
│   └── data/                    # SQLite DB, 대화 이력
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx         # 메인 (노트북 목록/선택)
│   │   │   └── chat/
│   │   │       └── [id]/
│   │   │           └── page.tsx # 챗봇 대화 화면
│   │   ├── components/
│   │   │   ├── ChatWindow.tsx   # 채팅 UI
│   │   │   ├── SourceManager.tsx # 소스 관리 UI
│   │   │   └── NotebookList.tsx # 노트북 목록
│   │   └── lib/
│   │       └── api.ts           # API 클라이언트
│   └── package.json
│
├── plan-notebooklm-chatbot.md   # 이 문서
└── CLAUDE.md
```

## 7. 사전 준비 사항

- [x] notebooklm-py 설치 (v0.3.4, Python 3.12 venv)
- [x] Playwright Chromium 설치
- [ ] `notebooklm login` — Google 계정 로그인 (브라우저 인증)
- [ ] 로그인 후 `notebooklm auth check --test`로 인증 확인

## 8. 구현 순서

### Phase 1: 백엔드 기본 구조
1. FastAPI 프로젝트 초기화
2. NotebookLMClient 래퍼 서비스 구현
3. 노트북 CRUD API
4. 소스 추가/조회 API
5. 챗봇 질의응답 API

### Phase 2: 프론트엔드
1. Next.js 프로젝트 초기화 (shadcn/ui)
2. 노트북 목록/선택 화면
3. 챗봇 대화 UI (메시지 버블, 입력창)
4. 소스 관리 UI (파일 업로드, URL 추가)

### Phase 3: 확장 기능
1. 오디오/퀴즈 등 콘텐츠 생성 기능
2. 대화 이력 저장 (SQLite)
3. 다중 노트북 전환

## 9. 제약 사항 및 주의

- **비공식 API**: Google이 내부 API를 변경하면 동작이 깨질 수 있음
- **인증 만료**: 쿠키 기반 인증이므로 주기적으로 `notebooklm login` 재인증 필요
- **Rate Limit**: 과도한 요청 시 Google에 의해 제한될 수 있음
- **개인/프로토타입 용도**: 프로덕션 서비스에는 부적합
