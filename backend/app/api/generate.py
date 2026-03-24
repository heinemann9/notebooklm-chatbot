import tempfile
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

from ..config import DATA_DIR
from ..services import notebooklm as nlm

router = APIRouter(prefix="/api/notebooks/{notebook_id}", tags=["generate"])


class GenerateRequest(BaseModel):
    source_ids: list[str] | None = None


class GenerateResponse(BaseModel):
    type: str
    task_id: str | None = None
    status: str | None = None
    data: dict | None = None


class ArtifactResponse(BaseModel):
    id: str
    title: str
    artifact_type: int
    status: int
    created_at: str | None = None
    url: str | None = None


@router.post("/generate/{content_type}", response_model=GenerateResponse)
async def generate_content(notebook_id: str, content_type: str, req: GenerateRequest):
    try:
        result = await nlm.generate_content(
            notebook_id, content_type, source_ids=req.source_ids
        )
        return GenerateResponse(
            type=result.get("type", content_type),
            task_id=result.get("task_id"),
            status=result.get("status"),
            data=result.get("data"),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/artifacts", response_model=list[ArtifactResponse])
async def list_artifacts(notebook_id: str):
    try:
        artifacts = await nlm.list_artifacts(notebook_id)
        return [
            ArtifactResponse(
                id=a.id,
                title=a.title,
                artifact_type=a.artifact_type,
                status=a.status,
                created_at=a.created_at.isoformat() if a.created_at else None,
                url=a.url,
            )
            for a in artifacts
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


ARTIFACT_TYPE_MAP = {
    1: ("audio", ".mp4"),
    2: ("video", ".mp4"),
    7: ("infographic", ".png"),
    8: ("slide_deck", ".pdf"),
}


@router.get("/artifacts/{artifact_id}/download")
async def download_artifact(notebook_id: str, artifact_id: str):
    try:
        artifacts = await nlm.list_artifacts(notebook_id)
        target = next((a for a in artifacts if a.id == artifact_id), None)
        if not target:
            raise HTTPException(status_code=404, detail="Artifact not found")

        type_info = ARTIFACT_TYPE_MAP.get(target.artifact_type)
        if not type_info:
            raise HTTPException(
                status_code=400,
                detail=f"Download not supported for artifact type {target.artifact_type}",
            )

        artifact_type_name, ext = type_info
        download_dir = DATA_DIR / "downloads"
        download_dir.mkdir(exist_ok=True)
        output_path = str(download_dir / f"{artifact_id}{ext}")

        await nlm.download_artifact(
            notebook_id, artifact_id, output_path, artifact_type=artifact_type_name
        )

        media_types = {
            ".mp4": "video/mp4",
            ".png": "image/png",
            ".pdf": "application/pdf",
        }

        return FileResponse(
            output_path,
            media_type=media_types.get(ext, "application/octet-stream"),
            filename=f"{target.title or artifact_id}{ext}",
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
