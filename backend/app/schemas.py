from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator


EntityId = str
Position = Literal["top-left", "top-right", "bottom-left", "bottom-right"]
ConnectionStatus = Literal["connecting", "connected", "disconnected"]

# APIとDBの間で共有する固定値。フロント側のconstants.tsと揃える。
POSITIONS: tuple[Position, ...] = ("top-left", "top-right", "bottom-left", "bottom-right")
VALID_STATUSES: set[str] = {"connecting", "connected", "disconnected"}


class StreamCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    mediamtx_path: str = Field(min_length=1, max_length=100)

    @field_validator("name", "mediamtx_path")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        # Pydanticのmin_lengthだけでは空白のみの文字列を弾けないため、サーバ側で正規化する。
        stripped = value.strip()
        if not stripped:
            raise ValueError("must not be blank")
        return stripped


class StreamUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    mediamtx_path: str | None = Field(default=None, min_length=1, max_length=100)

    @field_validator("name", "mediamtx_path")
    @classmethod
    def strip_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        if not stripped:
            raise ValueError("must not be blank")
        return stripped


class StreamRead(BaseModel):
    id: EntityId
    name: str
    mediamtx_path: str
    display_order: int


class ScenePlacementWrite(BaseModel):
    stream_id: EntityId
    position: Position


class ScenePlacementRead(BaseModel):
    stream_id: EntityId
    position: Position
    stream: StreamRead


class SceneCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    placements: list[ScenePlacementWrite] = Field(default_factory=list, max_length=4)

    @field_validator("name")
    @classmethod
    def strip_required_name(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("must not be blank")
        return stripped


class SceneUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    placements: list[ScenePlacementWrite] | None = Field(default=None, max_length=4)

    @field_validator("name")
    @classmethod
    def strip_optional_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        if not stripped:
            raise ValueError("must not be blank")
        return stripped


class SceneRead(BaseModel):
    id: EntityId
    name: str
    display_order: int
    placements: list[ScenePlacementRead]


class ActiveSceneUpdate(BaseModel):
    active_scene_id: EntityId | None


class SystemStateRead(BaseModel):
    active_scene_id: EntityId | None
    camera_statuses: dict[EntityId, ConnectionStatus]
    frontend_statuses: dict[EntityId, ConnectionStatus]


class SnapshotRead(BaseModel):
    state: SystemStateRead
    streams: list[StreamRead]
    scenes: list[SceneRead]


class ReorderRequest(BaseModel):
    ordered_ids: list[EntityId]


class WebSocketMessage(BaseModel):
    type: str
    payload: dict[str, Any] | None = None
