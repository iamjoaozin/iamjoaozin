from pathlib import Path
import sys


def app_root() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parents[1]


APP_ROOT = app_root()
DATA_DIR = APP_ROOT / "data"
PROFILES_DIR = DATA_DIR / "firefox_profiles"
DB_PATH = DATA_DIR / "accounts.sqlite3"

DEFAULT_PASSWORD = "Rocha145"
DEFAULT_LIMIT = 10
MAX_LIMIT = 10
DEFAULT_STEP_DELAY_SECONDS = 3.0
DEFAULT_VERIFY_BROWSER_IP = True
IP_CHECK_URLS = (
    "https://api.ipify.org",
    "https://ifconfig.me/ip",
)

LOCAL_HOST = "127.0.0.1"
LOCAL_PORT = 8765
LOCAL_BASE_URL = f"http://{LOCAL_HOST}:{LOCAL_PORT}"
