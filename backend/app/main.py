from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import CORS_ORIGINS
from .database import close_db
from .services.notebooklm import close_client
from .api import notebooks, sources, chat, generate


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
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

app.include_router(notebooks.router)
app.include_router(sources.router)
app.include_router(chat.router)
app.include_router(generate.router)


@app.get("/api/health")
async def health_check():
    return {"status": "ok"}
