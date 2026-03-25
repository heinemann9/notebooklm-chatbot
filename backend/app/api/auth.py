import asyncio
import base64
import logging

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect

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


@router.websocket("/login/ws")
async def login_websocket(websocket: WebSocket):
    """WebSocket login for Docker/remote environments. Streams screenshots and relays input."""
    await websocket.accept()

    # Origin check
    from ..config import CORS_ORIGINS
    origin = websocket.headers.get("origin", "")
    if origin and origin not in CORS_ORIGINS:
        await websocket.send_json({"type": "error", "message": "Origin not allowed"})
        await websocket.close(code=4003)
        return

    status = await check_auth_status()
    if status["authenticated"]:
        await websocket.send_json({"type": "status", "authenticated": True, "message": "Already authenticated"})
        await websocket.close()
        return

    if get_active_session() is not None:
        await websocket.send_json({"type": "error", "message": "A login session is already active."})
        await websocket.close(code=4001)
        return

    session = LoginSession()
    screenshot_task = None

    try:
        await session.start()
        await websocket.send_json({"type": "status", "authenticated": False, "message": "Browser started."})

        stop_event = asyncio.Event()

        async def screenshot_loop():
            while not stop_event.is_set():
                try:
                    png_bytes = await session.screenshot()
                    b64 = base64.b64encode(png_bytes).decode("ascii")
                    await websocket.send_json({"type": "screenshot", "data": b64})
                    if await session.check_login_complete():
                        await session.save_and_close()
                        await reset_client()
                        await websocket.send_json({"type": "status", "authenticated": True, "message": "Login successful!"})
                        stop_event.set()
                        return
                except Exception as e:
                    if not stop_event.is_set():
                        logger.warning("Screenshot loop error: %s", e)
                    return
                await asyncio.sleep(0.3)

        screenshot_task = asyncio.create_task(screenshot_loop())

        async def timeout_guard():
            await asyncio.sleep(LOGIN_TIMEOUT_SECONDS)
            if not stop_event.is_set():
                stop_event.set()
                try:
                    await websocket.send_json({"type": "error", "message": "Login timed out."})
                except Exception:
                    pass

        timeout_task = asyncio.create_task(timeout_guard())

        while not stop_event.is_set():
            try:
                msg = await asyncio.wait_for(websocket.receive_json(), timeout=1.0)
            except asyncio.TimeoutError:
                continue
            except (WebSocketDisconnect, Exception):
                break

            msg_type = msg.get("type")
            try:
                if msg_type == "click":
                    await session.click(float(msg.get("x", 0)), float(msg.get("y", 0)))
                elif msg_type == "type":
                    await session.type_text(str(msg.get("text", "")))
                elif msg_type == "keypress":
                    await session.keypress(str(msg.get("key", "")))
                elif msg_type == "scroll":
                    await session.scroll(float(msg.get("deltaX", 0)), float(msg.get("deltaY", 0)))
            except Exception as e:
                logger.warning("Input handling error: %s", e)

        stop_event.set()
        timeout_task.cancel()

    except Exception as e:
        logger.error("Login session error: %s", e)
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass
    finally:
        if screenshot_task and not screenshot_task.done():
            screenshot_task.cancel()
            try:
                await screenshot_task
            except (asyncio.CancelledError, Exception):
                pass
        await session.close()
        try:
            await websocket.close()
        except Exception:
            pass
