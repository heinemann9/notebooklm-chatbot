import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel

from ..config import UPLOAD_DIR
from ..services import notebooklm as nlm

router = APIRouter(prefix="/api/notebooks/{notebook_id}/sources", tags=["sources"])


class AddUrlRequest(BaseModel):
    url: str


class AddTextRequest(BaseModel):
    title: str
    content: str


class SourceResponse(BaseModel):
    id: str
    title: str | None = None
    url: str | None = None
    source_type: str = "text"
    status: int = 2
    created_at: str | None = None


def _source_to_response(src) -> SourceResponse:
    return SourceResponse(
        id=src.id,
        title=src.title,
        url=src.url,
        source_type=src.source_type,
        status=src.status,
        created_at=src.created_at.isoformat() if src.created_at else None,
    )


@router.get("", response_model=list[SourceResponse])
async def list_sources(notebook_id: str):
    try:
        sources = await nlm.list_sources(notebook_id)
        return [_source_to_response(s) for s in sources]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/url", response_model=SourceResponse)
async def add_url_source(notebook_id: str, req: AddUrlRequest):
    try:
        source = await nlm.add_url_source(notebook_id, req.url)
        return _source_to_response(source)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/text", response_model=SourceResponse)
async def add_text_source(notebook_id: str, req: AddTextRequest):
    try:
        source = await nlm.add_text_source(notebook_id, req.title, req.content)
        return _source_to_response(source)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/file", response_model=SourceResponse)
async def add_file_source(notebook_id: str, file: UploadFile = File(...)):
    unique_dir = UPLOAD_DIR / str(uuid.uuid4())
    unique_dir.mkdir(parents=True, exist_ok=True)
    tmp_path = unique_dir / file.filename
    try:
        with open(tmp_path, "wb") as f:
            shutil.copyfileobj(file.file, f)
        source = await nlm.add_file_source(notebook_id, str(tmp_path))
        return _source_to_response(source)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        tmp_path.unlink(missing_ok=True)
        unique_dir.rmdir()


@router.delete("/{source_id}")
async def delete_source(notebook_id: str, source_id: str):
    try:
        await nlm.delete_source(notebook_id, source_id)
        return {"status": "deleted", "id": source_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
