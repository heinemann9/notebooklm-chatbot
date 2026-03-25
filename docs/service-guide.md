# NotebookLM 챗봇 서비스 가이드

## 서비스 구조

```mermaid
graph TB
    subgraph Docker
        subgraph Backend["Backend (:8100)"]
            API_AUTH["/api/auth/*"]
            API_NB["/api/notebooks/*"]
            API_W["/api/w/* (공개)"]
            PW["Xvfb + Playwright"]
        end
        subgraph Frontend["Frontend (:3100)"]
            P_HOME["/ 관리자홈"]
            P_LOGIN["/login 로그인"]
            P_CHAT["/chat/[id] 관리채팅"]
            P_WIDGET["/w/chat 고객채팅"]
        end
    end

    Admin["👤 관리자"] -->|로그인 필요| P_HOME
    Admin -->|로그인 필요| P_CHAT
    Customer["👥 고객"] -->|인증 불필요| P_WIDGET

    P_HOME --> API_NB
    P_LOGIN --> API_AUTH
    P_CHAT --> API_NB
    P_WIDGET --> API_W

    API_AUTH --> PW
    API_NB --> NLM["☁️ NotebookLM API"]
    API_W --> NLM
```

---

## 관리자 흐름

```mermaid
sequenceDiagram
    actor Admin as 관리자
    participant FE as Frontend
    participant BE as Backend
    participant PW as Playwright
    participant NLM as NotebookLM

    Admin->>FE: /login 접속
    FE->>BE: POST /api/auth/login
    BE->>PW: Chromium 실행 (Xvfb)
    PW-->>Admin: Google 로그인 화면
    Admin->>PW: Google 로그인 완료
    PW->>BE: 쿠키 저장
    BE-->>FE: 인증 성공

    Admin->>FE: 노트북 생성
    FE->>BE: POST /api/notebooks
    BE->>NLM: 노트북 생성
    NLM-->>BE: 노트북 ID

    Admin->>FE: 소스 추가 (URL/파일)
    FE->>BE: POST /api/notebooks/{id}/sources/*
    BE->>NLM: 소스 업로드
    NLM-->>BE: 처리 완료

    Admin->>Admin: 고객에게 /w/chat 링크 공유
```

---

## 고객 흐름

```mermaid
sequenceDiagram
    actor Customer as 고객
    participant FE as Frontend (/w/chat)
    participant BE as Backend
    participant NLM as NotebookLM

    Customer->>FE: /w/chat 접속
    FE->>BE: GET /api/w/config
    BE-->>FE: 타이틀 + 노트북 목록

    FE-->>Customer: 주제 선택 화면
    Customer->>FE: 주제(노트북) 선택
    FE-->>Customer: 환영 메시지 + 채팅 시작

    loop 대화
        Customer->>FE: 질문 입력
        FE->>BE: POST /api/w/chat
        BE->>NLM: ask_notebook(id, question)
        NLM-->>BE: 답변
        BE-->>FE: { answer, conversation_id }
        FE-->>Customer: AI 답변 표시
    end
```

---

## 페이지 목록

### 관리자 페이지 (로그인 필요)

| URL | 설명 |
|-----|------|
| `http://localhost:3100/` | 노트북 목록 (생성/삭제) |
| `http://localhost:3100/login` | Google 로그인 |
| `http://localhost:3100/chat/{노트북ID}` | 노트북 채팅 + 소스 관리 |

### 고객 페이지 (로그인 불필요)

| URL | 설명 |
|-----|------|
| `http://localhost:3100/w/chat` | 공개 채팅 (주제 선택 → 채팅) |

---

## 실행 방법

### Docker 실행 (권장)

```bash
cd notebooklm-chatbot
docker compose up -d --build
```

| 서비스 | URL |
|--------|-----|
| 프론트엔드 | http://localhost:3100 |
| 백엔드 API | http://localhost:8100 |
| API 문서 (Swagger) | http://localhost:8100/docs |

### 종료 / 로그 확인

```bash
docker compose down              # 종료
docker compose logs -f backend   # 백엔드 로그
docker compose logs -f frontend  # 프론트엔드 로그
```

---

## 환경변수

`docker-compose.yml` 또는 `.env` 파일에서 설정:

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `WIDGET_TITLE` | `Support` | 고객 채팅 페이지 타이틀 |
| `WIDGET_WELCOME_MESSAGE` | `안녕하세요! 무엇을 도와드릴까요?` | 고객 채팅 첫 메시지 |

---

## API 엔드포인트

### 관리자 API (인증 필요)

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/auth/status` | 인증 상태 확인 |
| POST | `/api/auth/login` | 로그인 세션 시작 |
| GET | `/api/auth/login/poll` | 로그인 완료 폴링 |
| POST | `/api/auth/logout` | 로그아웃 |
| GET | `/api/notebooks` | 노트북 목록 |
| POST | `/api/notebooks` | 노트북 생성 |
| DELETE | `/api/notebooks/{id}` | 노트북 삭제 |
| GET | `/api/notebooks/{id}/sources` | 소스 목록 |
| POST | `/api/notebooks/{id}/sources/url` | URL 소스 추가 |
| POST | `/api/notebooks/{id}/sources/file` | 파일 소스 추가 |
| DELETE | `/api/notebooks/{id}/sources/{sid}` | 소스 삭제 |
| POST | `/api/notebooks/{id}/chat` | 관리자 채팅 |
| GET | `/api/notebooks/{id}/chat/history` | 채팅 히스토리 |

### 고객 API (인증 불필요)

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/w/config` | 위젯 설정 + 노트북 목록 |
| POST | `/api/w/chat` | 고객 채팅 (body: notebook_id, question, conversation_id?) |

---

## 참고사항

- **고객 채팅 히스토리**: 현재 브라우저 세션 내에서만 유지. 새로고침 시 리셋됨.
- **인증 쿠키**: Docker 볼륨 `notebooklm-auth`에 저장. 주기적으로 만료되므로 재로그인 필요.
- **NotebookLM 비공식 API**: Google 내부 API 변경 시 동작이 깨질 수 있음.
