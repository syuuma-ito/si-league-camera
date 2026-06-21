from sqlmodel import SQLModel, create_engine

from app.config import DATABASE_URL
from app.models import AppSetting, Scene, SceneStream, VideoStream


engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})


def create_db_and_tables() -> None:
    SQLModel.metadata.create_all(engine)


__all__ = [
    "AppSetting",
    "Scene",
    "SceneStream",
    "VideoStream",
    "create_db_and_tables",
    "engine",
]

