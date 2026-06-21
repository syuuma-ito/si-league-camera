from __future__ import annotations

from typing import Any

from fastapi import WebSocket, WebSocketDisconnect

from app.schemas import ConnectionStatus, EntityId


class RuntimeState:
    def __init__(self) -> None:
        # DBへ保存しない一時状態。MediaMTXからの監視結果だけを保持する。
        self.camera_statuses: dict[EntityId, ConnectionStatus] = {}


class ConnectionManager:
    def __init__(self) -> None:
        self.active_connections: set[WebSocket] = set()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections.add(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        self.active_connections.discard(websocket)

    async def broadcast(self, message: dict[str, Any]) -> None:
        # 送信に失敗した接続は、次回以降の配信対象から外す。
        disconnected: list[WebSocket] = []
        for websocket in tuple(self.active_connections):
            try:
                await websocket.send_json(message)
            except (RuntimeError, WebSocketDisconnect):
                disconnected.append(websocket)
        for websocket in disconnected:
            self.disconnect(websocket)


runtime_state = RuntimeState()
manager = ConnectionManager()
