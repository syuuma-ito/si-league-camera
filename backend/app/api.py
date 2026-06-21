from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from sqlmodel import Session, select

from app.database import engine
from app.models import Scene, SceneStream, VideoStream
from app.runtime import manager, runtime_state
from app.schemas import (
    ActiveSceneUpdate,
    ReorderRequest,
    SceneCreate,
    SceneRead,
    SceneUpdate,
    SnapshotRead,
    StreamCreate,
    StreamRead,
    StreamUpdate,
    SystemStateRead,
)
from app.services import (
    broadcast_snapshot,
    build_snapshot,
    get_active_scene_id,
    next_scene_order,
    next_stream_order,
    replace_scene_placements,
    reorder_scenes,
    reorder_streams,
    scene_to_read,
    set_active_scene_id,
    stream_to_read,
    validate_stream_path_available,
    validate_placements,
)


router = APIRouter()


@router.get("/api/snapshot", response_model=SnapshotRead)
def get_snapshot() -> SnapshotRead:
    with Session(engine) as session:
        return build_snapshot(session)


@router.get("/api/streams", response_model=list[StreamRead])
def list_streams() -> list[StreamRead]:
    with Session(engine) as session:
        streams = session.exec(select(VideoStream).order_by(VideoStream.display_order, VideoStream.name)).all()
        return [stream_to_read(stream) for stream in streams]


@router.post("/api/streams", response_model=StreamRead, status_code=201)
async def create_stream(payload: StreamCreate) -> StreamRead:
    with Session(engine) as session:
        # MediaMTXのパスは再生URLの一部なので、重複登録を防ぐ。
        validate_stream_path_available(session, payload.mediamtx_path)
        stream = VideoStream(
            name=payload.name,
            mediamtx_path=payload.mediamtx_path,
            display_order=next_stream_order(session),
        )
        session.add(stream)
        session.commit()
        session.refresh(stream)
        result = stream_to_read(stream)
    await broadcast_snapshot("config_changed")
    return result


@router.put("/api/streams/order", response_model=list[StreamRead])
async def update_stream_order(payload: ReorderRequest) -> list[StreamRead]:
    with Session(engine) as session:
        reorder_streams(session, payload.ordered_ids)
        session.commit()
        streams = session.exec(select(VideoStream).order_by(VideoStream.display_order, VideoStream.name)).all()
        result = [stream_to_read(stream) for stream in streams]
    await broadcast_snapshot("config_changed")
    return result


@router.put("/api/streams/{stream_id}", response_model=StreamRead)
async def update_stream(stream_id: str, payload: StreamUpdate) -> StreamRead:
    with Session(engine) as session:
        stream = session.get(VideoStream, stream_id)
        if stream is None:
            raise HTTPException(status_code=404, detail="Stream not found")
        if payload.name is not None:
            stream.name = payload.name
        if payload.mediamtx_path is not None:
            validate_stream_path_available(session, payload.mediamtx_path, stream_id)
            stream.mediamtx_path = payload.mediamtx_path
        session.add(stream)
        session.commit()
        session.refresh(stream)
        result = stream_to_read(stream)
    await broadcast_snapshot("config_changed")
    return result


@router.delete("/api/streams/{stream_id}", status_code=204)
async def delete_stream(stream_id: str) -> None:
    with Session(engine) as session:
        stream = session.get(VideoStream, stream_id)
        if stream is None:
            raise HTTPException(status_code=404, detail="Stream not found")
        # 関連するシーン配置を先に消して、削除後のスナップショットに孤児データを残さない。
        placements = session.exec(select(SceneStream).where(SceneStream.stream_id == stream_id)).all()
        for placement in placements:
            session.delete(placement)
        session.delete(stream)
        session.commit()
    runtime_state.camera_statuses.pop(stream_id, None)
    await broadcast_snapshot("config_changed")


@router.get("/api/scenes", response_model=list[SceneRead])
def list_scenes() -> list[SceneRead]:
    with Session(engine) as session:
        scenes = session.exec(select(Scene).order_by(Scene.display_order, Scene.name)).all()
        return [scene_to_read(session, scene) for scene in scenes]


@router.post("/api/scenes", response_model=SceneRead, status_code=201)
async def create_scene(payload: SceneCreate) -> SceneRead:
    with Session(engine) as session:
        # 配置の重複や存在しないストリームをDB更新前にまとめて検証する。
        validate_placements(session, payload.placements)
        scene = Scene(name=payload.name, display_order=next_scene_order(session))
        session.add(scene)
        session.commit()
        session.refresh(scene)
        replace_scene_placements(session, scene.id, payload.placements)
        session.commit()
        result = scene_to_read(session, scene)
    await broadcast_snapshot("config_changed")
    return result


@router.put("/api/scenes/order", response_model=list[SceneRead])
async def update_scene_order(payload: ReorderRequest) -> list[SceneRead]:
    with Session(engine) as session:
        reorder_scenes(session, payload.ordered_ids)
        session.commit()
        scenes = session.exec(select(Scene).order_by(Scene.display_order, Scene.name)).all()
        result = [scene_to_read(session, scene) for scene in scenes]
    await broadcast_snapshot("config_changed")
    return result


@router.put("/api/scenes/{scene_id}", response_model=SceneRead)
async def update_scene(scene_id: str, payload: SceneUpdate) -> SceneRead:
    with Session(engine) as session:
        scene = session.get(Scene, scene_id)
        if scene is None:
            raise HTTPException(status_code=404, detail="Scene not found")
        if payload.name is not None:
            scene.name = payload.name
        if payload.placements is not None:
            validate_placements(session, payload.placements, scene_id)
            replace_scene_placements(session, scene_id, payload.placements)
        session.add(scene)
        session.commit()
        session.refresh(scene)
        result = scene_to_read(session, scene)
    await broadcast_snapshot("config_changed")
    return result


@router.delete("/api/scenes/{scene_id}", status_code=204)
async def delete_scene(scene_id: str) -> None:
    with Session(engine) as session:
        scene = session.get(Scene, scene_id)
        if scene is None:
            raise HTTPException(status_code=404, detail="Scene not found")
        # 削除後に判定すると参照先が無くなるため、先に表示中かどうかを記録する。
        was_active_scene = get_active_scene_id(session) == scene_id
        placements = session.exec(select(SceneStream).where(SceneStream.scene_id == scene_id)).all()
        for placement in placements:
            session.delete(placement)
        session.delete(scene)
        if was_active_scene:
            replacement = session.exec(
                select(Scene).where(Scene.id != scene_id).order_by(Scene.display_order, Scene.name)
            ).first()
            set_active_scene_id(session, None if replacement is None else replacement.id)
        session.commit()
    await broadcast_snapshot("config_changed")


@router.put("/api/state/active-scene", response_model=SystemStateRead)
async def update_active_scene(payload: ActiveSceneUpdate) -> SystemStateRead:
    with Session(engine) as session:
        if payload.active_scene_id is not None and session.get(Scene, payload.active_scene_id) is None:
            raise HTTPException(status_code=404, detail="Scene not found")
        set_active_scene_id(session, payload.active_scene_id)
        session.commit()
        state = build_snapshot(session).state
    await broadcast_snapshot("state_changed")
    return state


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    await manager.connect(websocket)
    try:
        with Session(engine) as session:
            snapshot = build_snapshot(session)
        # 接続直後に現在値を送って、HTTP取得とWebSocket受信のタイミング差を吸収する。
        await websocket.send_json({"type": "snapshot", "payload": snapshot.model_dump()})
        while True:
            message = await websocket.receive()
            if message["type"] == "websocket.disconnect":
                break
    except WebSocketDisconnect:
        pass
    except RuntimeError:
        pass
    finally:
        manager.disconnect(websocket)
