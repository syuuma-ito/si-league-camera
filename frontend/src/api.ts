import type { FragmentMp4WsMap, Scene, ScenePayload, Snapshot, StreamPayload, SystemState, VideoStream, WebSocketMessage } from "./types";

const pageHost = typeof window === "undefined" ? "localhost" : window.location.hostname;
const backendHost = pageHost === "localhost" || pageHost === "127.0.0.1" ? "127.0.0.1" : pageHost;

// 環境変数が無い場合、HTTP APIはVite proxy経由、WebSocketはBackendへ直接接続する。
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";
export const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL ?? `ws://${backendHost}:8000`;
export const MEDIA_SERVER = import.meta.env.VITE_MEDIA_SERVER ?? `${pageHost}:8889`;
export const FMP4_WS_MAP_URL = import.meta.env.VITE_FMP4_WS_MAP_URL ?? "/fmp4-ws-map.json";

async function request(path: string, options?: RequestInit): Promise<void>;
async function request<T>(path: string, options?: RequestInit): Promise<T>;
async function request<T>(path: string, options: RequestInit = {}): Promise<T | void> {
    // JSON送信時だけContent-Typeを付け、DELETEなどの空ボディリクエストは素のまま送る。
    const headers = new Headers(options.headers);
    if (options.body !== undefined && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
    }

    const response = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers,
    });

    if (!response.ok) {
        // FastAPIのdetailをそのままUIへ渡せるよう、本文があれば優先して使う。
        const detail = await response.text();
        throw new Error(detail || `Request failed: ${response.status}`);
    }

    if (response.status === 204) {
        return;
    }

    return response.json() as Promise<T>;
}

export function getSnapshot(): Promise<Snapshot> {
    return request<Snapshot>("/api/snapshot");
}

export async function getFragmentMp4WsMap(): Promise<FragmentMp4WsMap> {
    const response = await fetch(FMP4_WS_MAP_URL);
    if (!response.ok) {
        throw new Error(`fMP4 WSマップの読み込みに失敗しました: ${response.status}`);
    }

    const data: unknown = await response.json();
    if (data === null || typeof data !== "object" || Array.isArray(data)) {
        throw new Error("fMP4 WSマップの形式が正しくありません");
    }

    const entries = Object.entries(data);
    if (!entries.every(([key, value]) => key.length > 0 && typeof value === "string" && value.length > 0)) {
        throw new Error("fMP4 WSマップにはMediaMTXパスとWSアドレスの文字列を指定してください");
    }

    return data as FragmentMp4WsMap;
}

export function createStream(payload: StreamPayload): Promise<void> {
    return request<VideoStream>("/api/streams", {
        method: "POST",
        body: JSON.stringify(payload),
    }).then(() => undefined);
}

export function updateStream(streamId: string, payload: StreamPayload): Promise<void> {
    return request<VideoStream>(`/api/streams/${streamId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
    }).then(() => undefined);
}

export function deleteStream(streamId: string): Promise<void> {
    return request(`/api/streams/${streamId}`, { method: "DELETE" });
}

export function updateStreamOrder(orderedIds: string[]): Promise<void> {
    return request<VideoStream[]>("/api/streams/order", {
        method: "PUT",
        body: JSON.stringify({ ordered_ids: orderedIds }),
    }).then(() => undefined);
}

export function createScene(payload: ScenePayload): Promise<Scene> {
    return request<Scene>("/api/scenes", {
        method: "POST",
        body: JSON.stringify(payload),
    });
}

export function updateScene(sceneId: string, payload: ScenePayload): Promise<Scene> {
    return request<Scene>(`/api/scenes/${sceneId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
    });
}

export function deleteScene(sceneId: string): Promise<void> {
    return request(`/api/scenes/${sceneId}`, { method: "DELETE" });
}

export function updateSceneOrder(orderedIds: string[]): Promise<void> {
    return request<Scene[]>("/api/scenes/order", {
        method: "PUT",
        body: JSON.stringify({ ordered_ids: orderedIds }),
    }).then(() => undefined);
}

export function updateActiveScene(activeSceneId: string | null): Promise<SystemState> {
    return request<SystemState>("/api/state/active-scene", {
        method: "PUT",
        body: JSON.stringify({ active_scene_id: activeSceneId }),
    });
}

export function getWebSocketUrl(): string {
    const url = new URL(WS_BASE_URL);
    url.pathname = "/ws";
    url.search = "";
    return url.toString();
}

export function parseWebSocketMessage(data: string): WebSocketMessage | null {
    // 想定外のメッセージは捨て、画面状態を壊さない。
    try {
        const message = JSON.parse(data) as WebSocketMessage;
        if (!message.payload || typeof message.type !== "string") {
            return null;
        }
        return message;
    } catch {
        return null;
    }
}
