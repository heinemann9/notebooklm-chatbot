import asyncio
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

_tasks: dict[str, "UploadTask"] = {}


@dataclass
class UploadTask:
    id: str
    notebook_id: str
    filename: str
    status: str = "pending"  # pending | uploading | processing | done | error
    error: str | None = None
    source: Any = None  # Source 객체 (완료 시)
    created_at: datetime = field(default_factory=datetime.now)


_cancel_events: dict[str, asyncio.Event] = {}


def create_task(notebook_id: str, filename: str) -> UploadTask:
    task = UploadTask(id=str(uuid.uuid4()), notebook_id=notebook_id, filename=filename)
    _tasks[task.id] = task
    _cancel_events[task.id] = asyncio.Event()
    return task


def cancel_task(task_id: str) -> bool:
    task = _tasks.get(task_id)
    if not task or task.status in ("done", "error"):
        return False
    task.status = "error"
    task.error = "Cancelled"
    event = _cancel_events.get(task_id)
    if event:
        event.set()
    return True


def is_cancelled(task_id: str) -> bool:
    event = _cancel_events.get(task_id)
    return event.is_set() if event else False


def get_task(task_id: str) -> UploadTask | None:
    return _tasks.get(task_id)


def list_tasks(notebook_id: str) -> list[UploadTask]:
    return [
        t for t in _tasks.values()
        if t.notebook_id == notebook_id and t.status not in ("done", "error")
        or (t.notebook_id == notebook_id and (datetime.now() - t.created_at).total_seconds() < 30)
    ]


def cleanup_old_tasks():
    """Remove tasks older than 5 minutes that are done or errored."""
    now = datetime.now()
    to_remove = [
        tid for tid, t in _tasks.items()
        if (now - t.created_at).total_seconds() > 300 and t.status in ("done", "error")
    ]
    for tid in to_remove:
        del _tasks[tid]
        _cancel_events.pop(tid, None)
