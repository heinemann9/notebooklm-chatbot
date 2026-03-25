import asyncio
import logging

from fastapi import APIRouter, HTTPException

from ..services.auth import (
    LoginSession,
    check_auth_status,
    do_logout,
    get_active_session,
    LOGIN_TIMEOUT_SECONDS,
)
from ..services.notebooklm import reset_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/status")
async def auth_status():
    return await check_auth_status()


@router.post("/logout")
async def logout():
    await do_logout()
    return {"status": "logged_out"}


@router.post("/login")
async def start_login():
    """Start a login session: opens a visible Chromium window on the server.

    The user completes Google login in that window.
    Use GET /api/auth/login/poll to check completion.
    """
    if get_active_session() is not None:
        raise HTTPException(
            status_code=409,
            detail="A login session is already active. Complete or cancel it first.",
        )

    status = await check_auth_status()
    if status["authenticated"]:
        return {"status": "already_authenticated"}

    session = LoginSession()
    try:
        await session.start()
    except Exception as e:
        await session.close()
        raise HTTPException(status_code=500, detail=f"Failed to start browser: {e}")

    # Start a background timeout task
    async def _timeout():
        await asyncio.sleep(LOGIN_TIMEOUT_SECONDS)
        sess = get_active_session()
        if sess is not None:
            logger.warning("Login session timed out after %ds", LOGIN_TIMEOUT_SECONDS)
            await sess.close()

    asyncio.create_task(_timeout())

    return {"status": "browser_opened", "message": "Complete Google login in the browser window."}


@router.get("/login/poll")
async def poll_login():
    """Poll whether the login has been completed in the browser window."""
    session = get_active_session()
    if session is None:
        # No active session — maybe already completed or timed out
        status = await check_auth_status()
        if status["authenticated"]:
            return {"status": "authenticated"}
        return {"status": "no_session", "message": "No active login session. Click Login to start."}

    try:
        if await session.check_login_complete():
            await session.save_and_close()
            await reset_client()
            return {"status": "authenticated"}
    except Exception as e:
        logger.warning("Poll check error: %s", e)
        await session.close()
        return {"status": "error", "message": str(e)}

    return {"status": "pending", "message": "Waiting for login in browser window..."}


@router.post("/login/cancel")
async def cancel_login():
    """Cancel the active login session and close the browser."""
    session = get_active_session()
    if session is None:
        return {"status": "no_session"}
    await session.close()
    return {"status": "cancelled"}
