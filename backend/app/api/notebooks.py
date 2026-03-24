from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..services import notebooklm as nlm

router = APIRouter(prefix="/api/notebooks", tags=["notebooks"])


class CreateNotebookRequest(BaseModel):
    title: str


class NotebookResponse(BaseModel):
    id: str
    title: str
    created_at: str | None = None
    sources_count: int = 0


def _notebook_to_response(nb) -> NotebookResponse:
    return NotebookResponse(
        id=nb.id,
        title=nb.title,
        created_at=nb.created_at.isoformat() if nb.created_at else None,
        sources_count=nb.sources_count,
    )


@router.post("", response_model=NotebookResponse)
async def create_notebook(req: CreateNotebookRequest):
    try:
        nb = await nlm.create_notebook(req.title)
        return _notebook_to_response(nb)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("", response_model=list[NotebookResponse])
async def list_notebooks():
    try:
        notebooks = await nlm.list_notebooks()
        return [_notebook_to_response(nb) for nb in notebooks]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{notebook_id}", response_model=NotebookResponse)
async def get_notebook(notebook_id: str):
    try:
        nb = await nlm.get_notebook(notebook_id)
        return _notebook_to_response(nb)
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/{notebook_id}")
async def delete_notebook(notebook_id: str):
    try:
        await nlm.delete_notebook(notebook_id)
        return {"status": "deleted", "id": notebook_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
