# NotebookLM Chatbot

Google NotebookLM 비공식 API(`notebooklm-py`)를 활용한 문서 기반 AI 챗봇 서비스.

## 사전 요구사항

- **Python 3.12+**
- **Node.js 18+** (npm 포함)
- **Google 계정** (NotebookLM 인증용)

## 1. 사전 준비 (NotebookLM 인증)

notebooklm-py는 브라우저 기반 Google 인증을 사용합니다. 최초 1회 로그인이 필요합니다.

```bash
# notebooklm-py 설치 (전역 또는 venv)
pip install notebooklm-py

# Playwright 브라우저 설치
playwright install chromium

# Google 계정 로그인 (브라우저가 열림)
notebooklm login

# 인증 확인
notebooklm auth check --test
```

## 2. 백엔드 실행 (FastAPI, :8000)

```bash
# 프로젝트 루트에서
cd backend

# 가상환경 생성 및 활성화
python3 -m venv venv
source venv/bin/activate

# 의존성 설치
pip install -r requirements.txt

# 서버 실행
uvicorn app.main:app --reload --port 8000
```

서버가 실행되면 아래 주소에서 API 문서를 확인할 수 있습니다:
- Swagger UI: http://localhost:8000/docs
- Health Check: http://localhost:8000/api/health

## 3. 프론트엔드 실행 (Next.js, :3000)

```bash
# 새 터미널에서 프로젝트 루트로 이동
cd frontend

# 의존성 설치
npm install

# 개발 서버 실행
npm run dev
```

브라우저에서 http://localhost:3000 접속.

## 4. 사용 방법

1. 메인 페이지에서 **노트북 생성**
2. 노트북에 **소스 추가** (URL, 파일 업로드, 텍스트)
3. 소스 기반으로 **챗봇 대화**
4. 필요시 **콘텐츠 생성** (오디오, 퀴즈, 요약 등)

## 프로젝트 구조

```
notebooklm-chatbot/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI 엔트리포인트
│   │   ├── config.py            # 설정
│   │   ├── database.py          # SQLite 대화 이력
│   │   ├── api/
│   │   │   ├── notebooks.py     # 노트북 CRUD
│   │   │   ├── sources.py       # 소스 관리
│   │   │   ├── chat.py          # 챗봇 질의응답
│   │   │   └── generate.py      # 콘텐츠 생성
│   │   └── services/
│   │       └── notebooklm.py    # NotebookLMClient 래퍼
│   ├── requirements.txt
│   └── data/                    # SQLite DB, 업로드 파일
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx         # 메인 (노트북 목록)
│   │   │   └── chat/[id]/
│   │   │       └── page.tsx     # 챗봇 대화
│   │   ├── components/
│   │   │   ├── ChatWindow.tsx   # 채팅 UI
│   │   │   ├── SourceManager.tsx# 소스 관리
│   │   │   └── NotebookList.tsx # 노트북 목록
│   │   └── lib/
│   │       └── api.ts           # API 클라이언트
│   └── package.json
│
└── README.md
```

## 주의사항

- **비공식 API**: Google 내부 API 변경 시 동작이 깨질 수 있습니다.
- **인증 만료**: 쿠키 기반 인증이므로 주기적으로 `notebooklm login` 재인증이 필요합니다.
- **Rate Limit**: 과도한 요청 시 Google에 의해 제한될 수 있습니다.
- **개인/프로토타입 용도**: 프로덕션 서비스에는 부적합합니다.
