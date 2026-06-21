from os import getenv
from pathlib import Path


def _csv_env(name: str, default: str) -> list[str]:
    # カンマ区切りの環境変数を空要素なしの配列として扱う。
    return [item.strip() for item in getenv(name, default).split(",") if item.strip()]


def _float_env(name: str, default: str) -> float:
    # ポーリング間隔など、0以下だと実行時に破綻する設定は起動時に止める。
    value = float(getenv(name, default))
    if value <= 0:
        raise ValueError(f"{name} must be greater than 0")
    return value


def _bool_env(name: str, default: str = "false") -> bool:
    # 本番環境で曖昧な文字列を誤って有効化しないよう、許可値だけを受け付ける。
    value = getenv(name, default).strip().lower()
    if value in {"1", "true", "yes", "on"}:
        return True
    if value in {"0", "false", "no", "off"}:
        return False
    raise ValueError(f"{name} must be a boolean value")


# デフォルト値はローカル開発でそのまま起動できる値に寄せ、必要な環境だけ上書きする。
DATABASE_PATH = Path(getenv("SI_LEAGUE_DATABASE_PATH", Path(__file__).resolve().parents[1] / "database.db"))
DATABASE_URL = f"sqlite:///{DATABASE_PATH}"
MEDIAMTX_API_URL = getenv("SI_LEAGUE_MEDIAMTX_API_URL", "http://localhost:9997").rstrip("/")
POLL_INTERVAL_SECONDS = _float_env("SI_LEAGUE_POLL_INTERVAL_SECONDS", "2.0")
CORS_ORIGINS = _csv_env("SI_LEAGUE_CORS_ORIGINS", "*")
SEED_DEMO_DATA = _bool_env("SI_LEAGUE_SEED_DEMO_DATA")
