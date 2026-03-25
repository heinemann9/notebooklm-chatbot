from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import CORS_ORIGINS
from .database import close_db
from .services.notebooklm import close_client
from .services.auth import close_login_session
from .api import notebooks, sources, chat, generate, auth


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await close_login_session()
    await close_client()
    await close_db()


app = FastAPI(
    title="NotebookLM Chatbot API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(notebooks.router)
app.include_router(sources.router)
app.include_router(chat.router)
app.include_router(generate.router)


@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    path = request.url.path
    if (
        path.startswith("/api/auth")
        or path == "/api/health"
        or path.startswith("/docs")
        or path.startswith("/openapi")
    ):
        return await call_next(request)

    if path.startswith("/api/"):
        from .services.auth import check_auth_status

        status = await check_auth_status()
        if not status["authenticated"]:
            return JSONResponse(
                status_code=401,
                content={"detail": "Not authenticated. Please login first."},
            )

    return await call_next(request)


@app.get("/api/health")
async def health_check():
    return {"status": "ok"}
