import asyncio
import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel

from ..config import UPLOAD_DIR
from ..services import notebooklm as nlm
from ..services.upload_tasks import create_task, get_task, list_tasks, cleanup_old_tasks, cancel_task, is_cancelled, UploadTask

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


class UploadTaskResponse(BaseModel):
    task_id: str
    notebook_id: str
    filename: str
    status: str
    error: str | None = None
    source: SourceResponse | None = None


def _source_to_response(src) -> SourceResponse:
    return SourceResponse(
        id=src.id,
        title=src.title,
        url=src.url,
        source_type=src.source_type,
        status=src.status,
        created_at=src.created_at.isoformat() if src.created_at else None,
    )


def _task_to_response(task: UploadTask) -> UploadTaskResponse:
    return UploadTaskResponse(
        task_id=task.id,
        notebook_id=task.notebook_id,
        filename=task.filename,
        status=task.status,
        error=task.error,
        source=_source_to_response(task.source) if task.source else None,
    )


@router.get("", response_model=list[SourceResponse])
async def list_sources(notebook_id: str):
    try:
        sources = await nlm.list_sources(notebook_id)
        return [_source_to_response(s) for s in sources]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/url", response_model=UploadTaskResponse)
async def add_url_source(notebook_id: str, req: AddUrlRequest):
    task = create_task(notebook_id, req.url)

    async def _process():
        try:
            task.status = "uploading"
            if is_cancelled(task.id):
                return
            source = await nlm.add_url_source(notebook_id, req.url)
            if not is_cancelled(task.id):
                task.status = "done"
                task.source = source
        except Exception as e:
            if not is_cancelled(task.id):
                task.status = "error"
                task.error = str(e)

    asyncio.create_task(_process())
    return _task_to_response(task)


@router.post("/text", response_model=SourceResponse)
async def add_text_source(notebook_id: str, req: AddTextRequest):
    try:
        source = await nlm.add_text_source(notebook_id, req.title, req.content)
        return _source_to_response(source)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/file", response_model=UploadTaskResponse)
async def add_file_source(notebook_id: str, file: UploadFile = File(...)):
    unique_dir = UPLOAD_DIR / str(uuid.uuid4())
    unique_dir.mkdir(parents=True, exist_ok=True)
    tmp_path = unique_dir / file.filename
    with open(tmp_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    task = create_task(notebook_id, file.filename)

    async def _process():
        try:
            task.status = "uploading"
            if is_cancelled(task.id):
                return
            source = await nlm.add_file_source(notebook_id, str(tmp_path))
            if not is_cancelled(task.id):
                task.status = "done"
                task.source = source
        except Exception as e:
            if not is_cancelled(task.id):
                task.status = "error"
                task.error = str(e)
        finally:
            tmp_path.unlink(missing_ok=True)
            try:
                unique_dir.rmdir()
            except OSError:
                pass

    asyncio.create_task(_process())
    return _task_to_response(task)


@router.get("/tasks", response_model=list[UploadTaskResponse])
async def get_upload_tasks(notebook_id: str):
    cleanup_old_tasks()
    tasks = list_tasks(notebook_id)
    return [_task_to_response(t) for t in tasks]


@router.get("/tasks/{task_id}", response_model=UploadTaskResponse)
async def get_upload_task(notebook_id: str, task_id: str):
    task = get_task(task_id)
    if not task or task.notebook_id != notebook_id:
        raise HTTPException(status_code=404, detail="Task not found")
    return _task_to_response(task)


@router.post("/tasks/{task_id}/cancel")
async def cancel_upload_task(notebook_id: str, task_id: str):
    task = get_task(task_id)
    if not task or task.notebook_id != notebook_id:
        raise HTTPException(status_code=404, detail="Task not found")
    if cancel_task(task_id):
        return {"status": "cancelled", "task_id": task_id}
    return {"status": "already_finished", "task_id": task_id}


@router.delete("/{source_id}")
async def delete_source(notebook_id: str, source_id: str):
    try:
        await nlm.delete_source(notebook_id, source_id)
        return {"status": "deleted", "id": source_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
