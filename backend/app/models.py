from __future__ import annotations

from uuid import uuid4

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel


def new_uuid() -> str:
    return str(uuid4())


class VideoStream(SQLModel, table=True):
    __tablename__ = "video_stream"

    id: str = Field(default_factory=new_uuid, primary_key=True)
    name: str = Field(index=True, min_length=1, max_length=100)
    mediamtx_path: str = Field(index=True, min_length=1, max_length=100)
    display_order: int = Field(default=0, index=True)


class Scene(SQLModel, table=True):
    __tablename__ = "scene"

    id: str = Field(default_factory=new_uuid, primary_key=True)
    name: str = Field(index=True, min_length=1, max_length=100)
    display_order: int = Field(default=0, index=True)


class SceneStream(SQLModel, table=True):
    __tablename__ = "scene_stream"
    __table_args__ = (UniqueConstraint("stream_id", name="uq_scene_stream_stream"),)

    scene_id: str = Field(foreign_key="scene.id", primary_key=True)
    stream_id: str = Field(foreign_key="video_stream.id")
    position: str = Field(primary_key=True)


class AppSetting(SQLModel, table=True):
    __tablename__ = "app_setting"

    key: str = Field(primary_key=True)
    value: str | None = None
