from __future__ import annotations

from typing import Any, cast

import httpx
from fastapi import HTTPException
from sqlalchemy import func
from sqlmodel import Session, select

from app.config import MEDIAMTX_API_URL
from app.database import engine
from app.models import AppSetting, Scene, SceneStream, VideoStream
from app.runtime import manager, runtime_state
from app.schemas import (
    ConnectionStatus,
    EntityId,
    POSITIONS,
    Position,
    ScenePlacementRead,
    ScenePlacementWrite,
    SceneRead,
    SnapshotRead,
    StreamRead,
    SystemStateRead,
)


def get_active_scene_id(session: Session) -> EntityId | None:
    setting = session.get(AppSetting, "active_scene_id")
    if setting is None or setting.value is None:
        return None
    # 古い設定値が残っていても、存在しないシーンは未選択として扱う。
    if session.get(Scene, setting.value) is None:
        return None
    return setting.value


def set_active_scene_id(session: Session, scene_id: EntityId | None) -> None:
    setting = session.get(AppSetting, "active_scene_id")
    if setting is None:
        setting = AppSetting(key="active_scene_id")
        session.add(setting)
    setting.value = scene_id


def stream_to_read(stream: VideoStream) -> StreamRead:
    return StreamRead(
        id=stream.id,
        name=stream.name,
        mediamtx_path=stream.mediamtx_path,
        display_order=stream.display_order,
    )


def scene_to_read(session: Session, scene: Scene) -> SceneRead:
    # 配置テーブルから関連ストリームを展開し、フロントが1回で描画できる形にする。
    placements = session.exec(
        select(SceneStream).where(SceneStream.scene_id == scene.id).order_by(SceneStream.position)
    ).all()
    placement_reads: list[ScenePlacementRead] = []
    for placement in placements:
        stream = session.get(VideoStream, placement.stream_id)
        if stream is None:
            continue
        placement_reads.append(
            ScenePlacementRead(
                stream_id=placement.stream_id,
                position=cast(Position, placement.position),
                stream=stream_to_read(stream),
            )
        )
    return SceneRead(
        id=scene.id,
        name=scene.name,
        display_order=scene.display_order,
        placements=placement_reads,
    )


def build_snapshot(session: Session) -> SnapshotRead:
    # 画面同期に必要な状態を1つのレスポンスへ集約する。
    streams = session.exec(select(VideoStream).order_by(VideoStream.display_order, VideoStream.name)).all()
    scenes = session.exec(select(Scene).order_by(Scene.display_order, Scene.name)).all()
    stream_reads = [stream_to_read(stream) for stream in streams]
    scene_reads = [scene_to_read(session, scene) for scene in scenes]

    stream_ids = {stream.id for stream in stream_reads}
    # DBに存在するストリームだけを対象にし、削除済みのランタイム状態は外へ出さない。
    camera_statuses = {
        stream_id: runtime_state.camera_statuses.get(stream_id, "disconnected")
        for stream_id in stream_ids
    }
    frontend_statuses = {stream_id: "disconnected" for stream_id in stream_ids}

    return SnapshotRead(
        state=SystemStateRead(
            active_scene_id=get_active_scene_id(session),
            camera_statuses=camera_statuses,
            frontend_statuses=frontend_statuses,
        ),
        streams=stream_reads,
        scenes=scene_reads,
    )


async def broadcast_snapshot(message_type: str = "snapshot") -> None:
    # 設定・状態・接続状況の変更後は、全クライアントへ最新スナップショットを配信する。
    with Session(engine) as session:
        snapshot = build_snapshot(session)
    await manager.broadcast({"type": message_type, "payload": snapshot.model_dump()})


def validate_placements(
    session: Session,
    placements: list[ScenePlacementWrite],
    scene_id: EntityId | None = None,
) -> None:
    # 2x2表示の前提を超える配置や、同じ枠/同じストリームの重複を拒否する。
    if len(placements) > 4:
        raise HTTPException(status_code=400, detail="A scene can contain up to 4 streams")

    positions = [placement.position for placement in placements]
    if len(set(positions)) != len(positions):
        raise HTTPException(status_code=400, detail="Scene positions must be unique")

    stream_ids = [placement.stream_id for placement in placements]
    if len(set(stream_ids)) != len(stream_ids):
        raise HTTPException(status_code=400, detail="Streams must be unique within a scene")

    for placement in placements:
        if placement.position not in POSITIONS:
            raise HTTPException(status_code=400, detail=f"Invalid position: {placement.position}")
        if session.get(VideoStream, placement.stream_id) is None:
            raise HTTPException(status_code=404, detail=f"Stream not found: {placement.stream_id}")

    existing_placements = session.exec(select(SceneStream)).all()
    used_elsewhere = {
        placement.stream_id
        for placement in existing_placements
        if placement.stream_id in stream_ids and placement.scene_id != scene_id
    }
    if used_elsewhere:
        raise HTTPException(status_code=409, detail="Streams are already used by another scene")


def validate_stream_path_available(session: Session, mediamtx_path: str, stream_id: EntityId | None = None) -> None:
    existing = session.exec(select(VideoStream).where(VideoStream.mediamtx_path == mediamtx_path)).first()
    if existing is not None and existing.id != stream_id:
        raise HTTPException(status_code=409, detail="MediaMTX path is already used by another stream")


def replace_scene_placements(session: Session, scene_id: EntityId, placements: list[ScenePlacementWrite]) -> None:
    # 配置は部分更新より全置換にして、フォームの状態とDBの状態を一致させる。
    validate_placements(session, placements, scene_id)
    existing = session.exec(select(SceneStream).where(SceneStream.scene_id == scene_id)).all()
    for placement in existing:
        session.delete(placement)
    for placement in placements:
        session.add(
            SceneStream(
                scene_id=scene_id,
                stream_id=placement.stream_id,
                position=placement.position,
            )
        )


def next_stream_order(session: Session) -> int:
    max_order = session.exec(select(func.max(VideoStream.display_order))).one()
    return 0 if max_order is None else int(max_order) + 1


def next_scene_order(session: Session) -> int:
    max_order = session.exec(select(func.max(Scene.display_order))).one()
    return 0 if max_order is None else int(max_order) + 1


def reorder_streams(session: Session, ordered_ids: list[EntityId]) -> None:
    # 並び替えは全IDの順序を受け取り、欠落や重複があるリクエストを拒否する。
    streams = session.exec(select(VideoStream)).all()
    stream_by_id = {stream.id: stream for stream in streams}
    if len(ordered_ids) != len(set(ordered_ids)):
        raise HTTPException(status_code=400, detail="ordered_ids contains duplicates")
    if set(ordered_ids) != set(stream_by_id.keys()):
        raise HTTPException(status_code=400, detail="ordered_ids must include every stream exactly once")
    for index, stream_id in enumerate(ordered_ids):
        stream_by_id[stream_id].display_order = index
        session.add(stream_by_id[stream_id])


def reorder_scenes(session: Session, ordered_ids: list[EntityId]) -> None:
    scenes = session.exec(select(Scene)).all()
    scene_by_id = {scene.id: scene for scene in scenes}
    if len(ordered_ids) != len(set(ordered_ids)):
        raise HTTPException(status_code=400, detail="ordered_ids contains duplicates")
    if set(ordered_ids) != set(scene_by_id.keys()):
        raise HTTPException(status_code=400, detail="ordered_ids must include every scene exactly once")
    for index, scene_id in enumerate(ordered_ids):
        scene_by_id[scene_id].display_order = index
        session.add(scene_by_id[scene_id])


def seed_demo_data() -> None:
    # ローカル確認用の初期データ。既存データがあるDBには追加入力しない。
    with Session(engine) as session:
        existing_stream = session.exec(select(VideoStream).limit(1)).first()
        if existing_stream is not None:
            return

        streams: list[VideoStream] = []
        for index in range(1, 9):
            stream = VideoStream(name=f"Camera {index}", mediamtx_path=f"cam{index}-main", display_order=index - 1)
            session.add(stream)
            streams.append(stream)
        session.commit()

        for stream in streams:
            session.refresh(stream)

        scene_a = Scene(name="Main 1-4", display_order=0)
        scene_b = Scene(name="Main 5-8", display_order=1)
        session.add(scene_a)
        session.add(scene_b)
        session.commit()
        session.refresh(scene_a)
        session.refresh(scene_b)

        for stream, position in zip(streams[:4], POSITIONS, strict=True):
            session.add(SceneStream(scene_id=scene_a.id, stream_id=stream.id, position=position))
        for stream, position in zip(streams[4:8], POSITIONS, strict=True):
            session.add(SceneStream(scene_id=scene_b.id, stream_id=stream.id, position=position))

        set_active_scene_id(session, scene_a.id)
        session.commit()


def status_from_mediamtx_path(path_item: dict[str, Any]) -> ConnectionStatus:
    # MediaMTXのAPI差分を吸収し、画面側で扱う3状態へ丸める。
    if path_item.get("ready") is True or path_item.get("sourceReady") is True:
        return "connected"
    if path_item.get("source") or path_item.get("sourceType"):
        return "connecting"
    return "disconnected"


async def poll_mediamtx_once() -> None:
    next_statuses: dict[EntityId, ConnectionStatus] = {}
    with Session(engine) as session:
        streams = session.exec(select(VideoStream)).all()
        # MediaMTXのパス名からアプリ内ストリームIDへ戻せるようにしておく。
        path_to_stream_id = {stream.mediamtx_path: stream.id for stream in streams}

    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            response = await client.get(f"{MEDIAMTX_API_URL}/v3/paths/list")
            response.raise_for_status()
            payload = response.json()
        items = payload.get("items", []) if isinstance(payload, dict) else []
        for item in items:
            if not isinstance(item, dict):
                continue
            path_name = item.get("name")
            stream_id = path_to_stream_id.get(path_name)
            if stream_id is not None:
                next_statuses[stream_id] = status_from_mediamtx_path(item)
        for stream_id in path_to_stream_id.values():
            next_statuses.setdefault(stream_id, "disconnected")
    except (httpx.HTTPError, ValueError):
        # MediaMTXが落ちている/壊れたJSONを返す場合は、全カメラを切断として扱う。
        next_statuses = {stream_id: "disconnected" for stream_id in path_to_stream_id.values()}

    if next_statuses != runtime_state.camera_statuses:
        runtime_state.camera_statuses = next_statuses
        await broadcast_snapshot("status_changed")
