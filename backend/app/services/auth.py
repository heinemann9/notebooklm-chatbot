import asyncio
import hmac
import json
import logging
import os
import secrets
import shutil

from pathlib import Path

from notebooklm.paths import get_home_dir, get_storage_path, get_browser_profile_dir

logger = logging.getLogger(__name__)

_active_session: "LoginSession | None" = None
_admin_session_token: str | None = None
_SESSION_FILE = Path(__file__).resolve().parent.parent.parent / "data" / ".admin_session"

NOTEBOOKLM_URL = "https://notebooklm.google.com/"
GOOGLE_ACCOUNTS_URL = "https://accounts.google.com/"
LOGIN_TIMEOUT_SECONDS = 300  # 5 minutes

VIEWPORT_WIDTH = 1280
VIEWPORT_HEIGHT = 800

ALLOWED_KEYS = frozenset({
    "Enter", "Tab", "Backspace", "Delete", "Escape",
    "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
    "Home", "End", "PageUp", "PageDown", "Space",
})


def _is_docker() -> bool:
    """Check if running in Docker (Xvfb environment without physical display)."""
    return os.path.exists("/.dockerenv") or os.environ.get("DISPLAY") == ":99"


def _load_session_token():
    """Load session token from file on startup."""
    global _admin_session_token
    if _SESSION_FILE.exists():
        try:
            _admin_session_token = _SESSION_FILE.read_text().strip()
        except Exception:
            _admin_session_token = None


def create_admin_session() -> str:
    global _admin_session_token
    _admin_session_token = secrets.token_urlsafe(32)
    try:
        _SESSION_FILE.parent.mkdir(parents=True, exist_ok=True)
        _SESSION_FILE.write_text(_admin_session_token)
        _SESSION_FILE.chmod(0o600)
    except Exception as e:
        logger.warning("Failed to persist session token: %s", e)
    return _admin_session_token


def validate_admin_session(token: str | None) -> bool:
    if token is None or _admin_session_token is None:
        return False
    return hmac.compare_digest(token, _admin_session_token)


def clear_admin_session():
    global _admin_session_token
    _admin_session_token = None
    try:
        _SESSION_FILE.unlink(missing_ok=True)
    except Exception:
        pass


# Load persisted session on module import
_load_session_token()


async def check_auth_status() -> dict:
    """Check if valid authentication exists (fast file check, no network)."""
    login_mode = "remote" if _is_docker() else "local"
    storage_path = get_storage_path()
    if not storage_path.exists():
        return {"authenticated": False, "message": "No storage state file found", "login_mode": login_mode}
    try:
        data = json.loads(storage_path.read_text(encoding="utf-8"))
        cookies = data.get("cookies", [])
        has_sid = any(c.get("name") == "SID" for c in cookies)
        if not has_sid:
            return {"authenticated": False, "message": "SID cookie missing", "login_mode": login_mode}
        return {"authenticated": True, "login_mode": login_mode}
    except Exception as e:
        return {"authenticated": False, "message": f"Invalid storage state: {e}", "login_mode": login_mode}


async def do_logout():
    """Delete storage state and reset the NotebookLM client."""
    from .notebooklm import reset_client

    storage_path = get_storage_path()
    if storage_path.exists():
        storage_path.unlink()

    # Clear browser profile so next login starts fresh (no cached session)
    browser_profile = get_browser_profile_dir()
    if browser_profile.exists():
        shutil.rmtree(browser_profile, ignore_errors=True)

    await reset_client()


def get_active_session() -> "LoginSession | None":
    return _active_session


class LoginSession:
    """Manages a visible Playwright browser for Google login.

    Opens a real Chromium window on the desktop. The user completes
    Google login in that window. The server polls the URL to detect
    login completion, then saves cookies and closes the browser.
    """

    def __init__(self):
        self._playwright = None
        self._context = None
        self._page = None
        self._closed = False

    async def start(self):
        global _active_session
        if _active_session is not None:
            raise RuntimeError("A login session is already active")

        from playwright.async_api import async_playwright

        self._playwright = await async_playwright().start()
        browser_profile = get_browser_profile_dir()
        browser_profile.mkdir(parents=True, exist_ok=True)

        self._context = await self._playwright.chromium.launch_persistent_context(
            user_data_dir=str(browser_profile),
            headless=False,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--password-store=basic",
            ],
            ignore_default_args=["--enable-automation"],
            viewport={"width": VIEWPORT_WIDTH, "height": VIEWPORT_HEIGHT} if _is_docker() else None,
        )
        self._page = (
            self._context.pages[0]
            if self._context.pages
            else await self._context.new_page()
        )
        await self._page.goto(NOTEBOOKLM_URL, wait_until="load")
        _active_session = self

    async def check_login_complete(self) -> bool:
        if self._closed or self._page is None:
            return False
        url = self._page.url
        return (
            "notebooklm.google.com" in url
            and "accounts.google.com" not in url
            and "signin" not in url.lower()
        )

    async def save_and_close(self):
        """Save storage state (mimics CLI flow) and close."""
        if self._closed or self._context is None:
            return

        # Navigate to accounts.google.com first to capture regional cookies
        try:
            await self._page.goto(GOOGLE_ACCOUNTS_URL, wait_until="load", timeout=10000)
        except Exception:
            pass

        # Navigate back to NotebookLM
        try:
            await self._page.goto(NOTEBOOKLM_URL, wait_until="load", timeout=15000)
        except Exception:
            pass

        # Save storage state
        storage_path = get_storage_path()
        get_home_dir(create=True)
        await self._context.storage_state(path=str(storage_path))
        storage_path.chmod(0o600)

        logger.info("Storage state saved to %s", storage_path)
        await self.close()

    async def screenshot(self) -> bytes:
        """Take a PNG screenshot of the current page."""
        if self._closed or self._page is None:
            raise RuntimeError("Session is closed")
        return await self._page.screenshot(type="png")

    async def click(self, x: float, y: float):
        """Click at coordinates, clamped to viewport bounds."""
        if self._closed or self._page is None:
            raise RuntimeError("Session is closed")
        cx = max(0.0, min(x, float(VIEWPORT_WIDTH - 1)))
        cy = max(0.0, min(y, float(VIEWPORT_HEIGHT - 1)))
        await self._page.mouse.click(cx, cy)

    async def type_text(self, text: str):
        """Type text into the focused element (max 1000 chars)."""
        if self._closed or self._page is None:
            raise RuntimeError("Session is closed")
        await self._page.keyboard.type(text[:1000])

    async def keypress(self, key: str):
        """Press a special key (validated against allowlist)."""
        if self._closed or self._page is None:
            raise RuntimeError("Session is closed")
        if key not in ALLOWED_KEYS:
            raise ValueError(f"Key not allowed: {key}")
        await self._page.keyboard.press(key)

    async def scroll(self, delta_x: float, delta_y: float):
        """Mouse wheel scroll."""
        if self._closed or self._page is None:
            raise RuntimeError("Session is closed")
        await self._page.mouse.wheel(delta_x, delta_y)

    async def close(self):
        global _active_session
        if self._closed:
            return
        self._closed = True
        _active_session = None

        try:
            if self._context:
                await self._context.close()
        except Exception as e:
            logger.warning("Error closing browser context: %s", e)
        try:
            if self._playwright:
                await self._playwright.stop()
        except Exception as e:
            logger.warning("Error stopping playwright: %s", e)

        self._context = None
        self._page = None
        self._playwright = None


async def close_login_session():
    """Cleanup for lifespan shutdown."""
    global _active_session
    if _active_session is not None:
        await _active_session.close()
