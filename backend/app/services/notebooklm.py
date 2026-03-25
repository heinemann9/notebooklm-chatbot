import logging
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Optional

from notebooklm import NotebookLMClient
from notebooklm.types import (
    AskResult,
    Artifact,
    GenerationStatus,
    Notebook,
    Source,
)

logger = logging.getLogger(__name__)

_client: NotebookLMClient | None = None


async def get_client() -> NotebookLMClient:
    global _client
    if _client is None:
        client_instance = await NotebookLMClient.from_storage()
        _client = await client_instance.__aenter__()
    return _client


async def close_client():
    global _client
    if _client is not None:
        await _client.__aexit__(None, None, None)
        _client = None


async def reset_client():
    """Close client so next get_client() reloads from fresh storage."""
    await close_client()


# --- Notebooks ---

async def list_notebooks() -> list[Notebook]:
    client = await get_client()
    return await client.notebooks.list()


async def create_notebook(title: str) -> Notebook:
    client = await get_client()
    return await client.notebooks.create(title)


async def get_notebook(notebook_id: str) -> Notebook:
    client = await get_client()
    return await client.notebooks.get(notebook_id)


async def delete_notebook(notebook_id: str) -> None:
    client = await get_client()
    await client.notebooks.delete(notebook_id)


# --- Sources ---

async def list_sources(notebook_id: str) -> list[Source]:
    client = await get_client()
    return await client.sources.list(notebook_id)


async def add_url_source(notebook_id: str, url: str) -> Source:
    client = await get_client()
    return await client.sources.add_url(notebook_id, url, wait=True)


async def add_text_source(notebook_id: str, title: str, content: str) -> Source:
    client = await get_client()
    return await client.sources.add_text(notebook_id, title, content, wait=True)


async def add_file_source(notebook_id: str, file_path: str) -> Source:
    client = await get_client()
    return await client.sources.add_file(notebook_id, file_path, wait=True)


async def delete_source(notebook_id: str, source_id: str) -> None:
    client = await get_client()
    await client.sources.delete(notebook_id, source_id)


# --- Chat ---

async def ask_notebook(
    notebook_id: str,
    question: str,
    conversation_id: Optional[str] = None,
    source_ids: Optional[list[str]] = None,
) -> AskResult:
    client = await get_client()
    return await client.chat.ask(
        notebook_id,
        question,
        source_ids=source_ids,
        conversation_id=conversation_id,
    )


# --- Artifacts / Content Generation ---

GENERATE_METHODS = {
    "audio": "generate_audio",
    "video": "generate_video",
    "quiz": "generate_quiz",
    "flashcards": "generate_flashcards",
    "summary": "generate_report",
    "report": "generate_report",
    "study_guide": "generate_study_guide",
    "infographic": "generate_infographic",
    "slide_deck": "generate_slide_deck",
    "data_table": "generate_data_table",
    "mind_map": "generate_mind_map",
}


async def generate_content(
    notebook_id: str,
    content_type: str,
    source_ids: Optional[list[str]] = None,
) -> dict[str, Any]:
    client = await get_client()
    method_name = GENERATE_METHODS.get(content_type)
    if not method_name:
        raise ValueError(f"Unknown content type: {content_type}. Available: {list(GENERATE_METHODS.keys())}")

    method = getattr(client.artifacts, method_name)

    if content_type == "mind_map":
        result = await method(notebook_id, source_ids=source_ids)
        return {"type": "mind_map", "data": result}

    status: GenerationStatus = await method(notebook_id, source_ids=source_ids)
    return {
        "type": content_type,
        "task_id": status.task_id,
        "status": status.status,
    }


async def list_artifacts(notebook_id: str) -> list[Artifact]:
    client = await get_client()
    return await client.artifacts.list(notebook_id)


async def get_generation_status(notebook_id: str, task_id: str) -> GenerationStatus:
    client = await get_client()
    return await client.artifacts.get_status(notebook_id, task_id)


async def download_artifact(
    notebook_id: str,
    artifact_id: str,
    output_path: str,
    artifact_type: str = "audio",
) -> str:
    client = await get_client()
    download_methods = {
        "audio": client.artifacts.download_audio,
        "video": client.artifacts.download_video,
        "infographic": client.artifacts.download_infographic,
        "slide_deck": client.artifacts.download_slide_deck,
    }
    method = download_methods.get(artifact_type)
    if not method:
        raise ValueError(f"Download not supported for type: {artifact_type}")
    return await method(notebook_id, output_path, artifact_id=artifact_id)
