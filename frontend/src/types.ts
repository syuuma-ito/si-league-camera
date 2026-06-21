export type Position = "top-left" | "top-right" | "bottom-left" | "bottom-right";
export type ConnectionStatus = "connecting" | "connected" | "disconnected";

export type VideoStream = {
    id: string;
    name: string;
    mediamtx_path: string;
    display_order: number;
};

export type FragmentMp4WsMap = Record<string, string>;

export type ScenePlacement = {
    stream_id: string;
    position: Position;
    stream: VideoStream;
};

export type Scene = {
    id: string;
    name: string;
    display_order: number;
    placements: ScenePlacement[];
};

export type SystemState = {
    active_scene_id: string | null;
    camera_statuses: Record<string, ConnectionStatus>;
    frontend_statuses: Record<string, ConnectionStatus>;
};

export type Snapshot = {
    state: SystemState;
    streams: VideoStream[];
    scenes: Scene[];
};

export type StreamPayload = {
    name: string;
    mediamtx_path: string;
};

export type ScenePayload = {
    name: string;
    placements: Array<{
        stream_id: string;
        position: Position;
    }>;
};

export type WebSocketMessage = {
    type: "snapshot" | "config_changed" | "state_changed" | "status_changed";
    payload: Snapshot;
};
