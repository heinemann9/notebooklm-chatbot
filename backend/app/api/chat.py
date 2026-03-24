from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..database import get_db
from ..services import notebooklm as nlm

router = APIRouter(prefix="/api/notebooks/{notebook_id}/chat", tags=["chat"])


class ChatRequest(BaseModel):
    question: str
    conversation_id: str | None = None
    source_ids: list[str] | None = None


class ChatResponse(BaseModel):
    answer: str
    conversation_id: str
    turn_number: int
    is_follow_up: bool


class ChatHistoryItem(BaseModel):
    role: str
    content: str
    turn_number: int
    conversation_id: str
    created_at: str


@router.post("", response_model=ChatResponse)
async def chat(notebook_id: str, req: ChatRequest):
    try:
        result = await nlm.ask_notebook(
            notebook_id,
            req.question,
            conversation_id=req.conversation_id,
            source_ids=req.source_ids,
        )

        db = await get_db()
        await db.execute(
            "INSERT INTO chat_history (notebook_id, conversation_id, role, content, turn_number) VALUES (?, ?, ?, ?, ?)",
            (notebook_id, result.conversation_id, "user", req.question, result.turn_number),
        )
        await db.execute(
            "INSERT INTO chat_history (notebook_id, conversation_id, role, content, turn_number) VALUES (?, ?, ?, ?, ?)",
            (notebook_id, result.conversation_id, "assistant", result.answer, result.turn_number),
        )
        await db.commit()

        return ChatResponse(
            answer=result.answer,
            conversation_id=result.conversation_id,
            turn_number=result.turn_number,
            is_follow_up=result.is_follow_up,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history", response_model=list[ChatHistoryItem])
async def get_chat_history(notebook_id: str, conversation_id: str | None = None):
    try:
        db = await get_db()
        if conversation_id:
            cursor = await db.execute(
                "SELECT role, content, turn_number, conversation_id, created_at FROM chat_history WHERE notebook_id = ? AND conversation_id = ? ORDER BY id ASC",
                (notebook_id, conversation_id),
            )
        else:
            cursor = await db.execute(
                "SELECT role, content, turn_number, conversation_id, created_at FROM chat_history WHERE notebook_id = ? ORDER BY id ASC",
                (notebook_id,),
            )
        rows = await cursor.fetchall()
        return [
            ChatHistoryItem(
                role=row[0],
                content=row[1],
                turn_number=row[2],
                conversation_id=row[3],
                created_at=row[4],
            )
            for row in rows
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
