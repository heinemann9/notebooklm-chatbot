import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)

DB_PATH = DATA_DIR / "chat_history.db"
UPLOAD_DIR = DATA_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

CORS_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3100",
    "http://127.0.0.1:3100",
    "http://172.30.1.98:3100",
    "https://0a23-220-76-41-89.ngrok-free.app",
]

WIDGET_NOTEBOOK_ID = os.environ.get("WIDGET_NOTEBOOK_ID", "")
WIDGET_TITLE = os.environ.get("WIDGET_TITLE", "Support")
WIDGET_WELCOME_MESSAGE = os.environ.get("WIDGET_WELCOME_MESSAGE", "안녕하세요! 무엇을 도와드릴까요?")

ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "")
