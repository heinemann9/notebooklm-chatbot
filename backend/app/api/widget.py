from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from ..config import WIDGET_TITLE, WIDGET_WELCOME_MESSAGE
from ..services.notebooklm import ask_notebook, list_notebooks

router = APIRouter(prefix="/api/w", tags=["widget"])


class WidgetChatRequest(BaseModel):
    question: str
    notebook_id: str
    conversation_id: Optional[str] = None


@router.get("/config")
async def widget_config():
    try:
        notebooks = await list_notebooks()
        return {
            "title": WIDGET_TITLE,
            "welcome_message": WIDGET_WELCOME_MESSAGE,
            "notebooks": [
                {"id": nb.id, "title": nb.title or "Untitled"}
                for nb in notebooks
            ],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/chat")
async def widget_chat(req: WidgetChatRequest):
    if not req.notebook_id:
        raise HTTPException(status_code=400, detail="notebook_id is required.")
    try:
        result = await ask_notebook(
            req.notebook_id,
            req.question,
            conversation_id=req.conversation_id,
        )
        return {
            "answer": result.answer,
            "conversation_id": result.conversation_id,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
