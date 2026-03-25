import asyncio
import base64
import logging

from fastapi import APIRouter, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from ..services.auth import (
    LoginSession,
    check_auth_status,
    clear_admin_session,
    create_admin_session,
    do_logout,
    get_active_session,
    validate_admin_session,
    LOGIN_TIMEOUT_SECONDS,
)
from ..services.notebooklm import reset_client
from ..config import ADMIN_PASSWORD

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginRequest(BaseModel):
    password: str


class SessionRequest(BaseModel):
    token: str


# --- Admin Authentication (password-based) ---


@router.get("/status")
async def auth_status(request: Request):
    """Check admin session + NotebookLM connection status separately."""
    token = request.cookies.get("admin_session")
    admin_ok = validate_admin_session(token)
    nlm_status = await check_auth_status()
    return {
        "authenticated": admin_ok,
        "notebooklm_authenticated": nlm_status["authenticated"],
        "login_mode": nlm_status.get("login_mode"),
    }


@router.post("/login")
async def admin_login(body: LoginRequest):
    """Verify admin password and create session cookie. No Google login."""
    if not ADMIN_PASSWORD:
        raise HTTPException(status_code=500, detail="ADMIN_PASSWORD not configured on server.")
    if body.password != ADMIN_PASSWORD:
        raise HTTPException(status_code=403, detail="Invalid admin password.")

    token = create_admin_session()
    response = JSONResponse(content={"status": "authenticated"})
    response.set_cookie("admin_session", token, httponly=True, samesite="lax", path="/")
    return response


@router.post("/logout")
async def logout():
    """Clear admin session. NotebookLM cookies are preserved."""
    clear_admin_session()
    response = JSONResponse(content={"status": "logged_out"})
    response.delete_cookie("admin_session", path="/")
    return response


# --- NotebookLM Google Login (separate from admin auth) ---


@router.post("/notebooklm/login")
async def start_notebooklm_login():
    """Start Google login for NotebookLM. Opens a Chromium browser on the server."""
    if get_active_session() is not None:
        raise HTTPException(
            status_code=409,
            detail="A login session is already active. Complete or cancel it first.",
        )

    nlm_status = await check_auth_status()
    if nlm_status["authenticated"]:
        return {"status": "already_connected"}

    session = LoginSession()
    try:
        await session.start()
    except Exception as e:
        await session.close()
        raise HTTPException(status_code=500, detail=f"Failed to start browser: {e}")

    async def _timeout():
        await asyncio.sleep(LOGIN_TIMEOUT_SECONDS)
        sess = get_active_session()
        if sess is not None:
            logger.warning("Login session timed out after %ds", LOGIN_TIMEOUT_SECONDS)
            await sess.close()

    asyncio.create_task(_timeout())

    return {"status": "browser_opened", "message": "Complete Google login in the browser window."}


@router.get("/notebooklm/poll")
async def poll_notebooklm_login():
    """Poll whether Google login has been completed."""
    session = get_active_session()
    if session is None:
        nlm_status = await check_auth_status()
        if nlm_status["authenticated"]:
            return {"status": "connected"}
        return {"status": "no_session", "message": "No active login session."}

    try:
        if await session.check_login_complete():
            await session.save_and_close()
            await reset_client()
            return {"status": "connected"}
    except Exception as e:
        logger.warning("Poll check error: %s", e)
        await session.close()
        return {"status": "error", "message": str(e)}

    return {"status": "pending", "message": "Waiting for login in browser window..."}


@router.post("/notebooklm/cancel")
async def cancel_notebooklm_login():
    """Cancel the active Google login session."""
    session = get_active_session()
    if session is None:
        return {"status": "no_session"}
    await session.close()
    return {"status": "cancelled"}


@router.post("/notebooklm/disconnect")
async def disconnect_notebooklm():
    """Remove NotebookLM cookies (disconnect Google account)."""
    await do_logout()
    return {"status": "disconnected"}


@router.websocket("/notebooklm/ws")
async def notebooklm_login_websocket(websocket: WebSocket):
    """WebSocket login for Docker/remote environments. Streams screenshots and relays input."""
    await websocket.accept()

    from ..config import CORS_ORIGINS
    origin = websocket.headers.get("origin", "")
    if origin and origin not in CORS_ORIGINS:
        await websocket.send_json({"type": "error", "message": "Origin not allowed"})
        await websocket.close(code=4003)
        return

    nlm_status = await check_auth_status()
    if nlm_status["authenticated"]:
        await websocket.send_json({"type": "status", "connected": True, "message": "Already connected"})
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
        await websocket.send_json({"type": "status", "connected": False, "message": "Browser started."})

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
                        await websocket.send_json({"type": "status", "connected": True, "message": "Connected!"})
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
