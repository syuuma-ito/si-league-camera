import { getSnapshot, getWebSocketUrl, parseWebSocketMessage } from "@/api";
import { MainScreen } from "@/screens/MainScreen";
import { SettingsScreen } from "@/screens/SettingsScreen";
import { StreamsScreen } from "@/screens/StreamsScreen";
import type { ConnectionStatus, Snapshot } from "@/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

function App() {
    const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
    const [frontendStatuses, setFrontendStatuses] = useState<Record<string, ConnectionStatus>>({});
    const [serverStatus, setServerStatus] = useState<ConnectionStatus>("connecting");
    const [error, setError] = useState<string | null>(null);
    const websocketRef = useRef<WebSocket | null>(null);

    const refresh = useCallback(async () => {
        // 操作後はHTTPでも取り直し、WebSocket遅延時にも画面を最新化する。
        const nextSnapshot = await getSnapshot();
        setSnapshot(nextSnapshot);
    }, []);

    // 初回表示用のスナップショットを取得する
    useEffect(() => {
        void getSnapshot()
            .then((nextSnapshot) => setSnapshot(nextSnapshot))
            .catch((err) => setError(err instanceof Error ? err.message : String(err)));
    }, []);

    // 設定変更はWebSocketで受け取り、全画面の状態を同期する
    useEffect(() => {
        let isDisposed = false;
        let reconnectTimer: number | undefined;

        const connect = () => {
            if (isDisposed) return;
            setServerStatus("connecting");
            const websocket = new WebSocket(getWebSocketUrl());
            websocketRef.current = websocket;
            websocket.onopen = () => {
                setServerStatus("connected");
                setError(null);
            };
            websocket.onmessage = (event) => {
                const message = parseWebSocketMessage(String(event.data));
                if (message?.payload) {
                    setSnapshot(message.payload);
                }
            };
            websocket.onerror = () => {
                setError("WebSocketの接続に失敗しました");
            };
            websocket.onclose = () => {
                if (websocketRef.current === websocket) {
                    websocketRef.current = null;
                }
                if (!isDisposed) {
                    setServerStatus("disconnected");
                    reconnectTimer = window.setTimeout(connect, 2000);
                }
            };
        };

        connect();

        return () => {
            isDisposed = true;
            if (reconnectTimer !== undefined) {
                window.clearTimeout(reconnectTimer);
            }
            websocketRef.current?.close();
            websocketRef.current = null;
        };
    }, []);

    // フロント側の再生状態だけをローカルに保持する
    const reportStatus = useCallback((streamId: string, status: ConnectionStatus) => {
        setFrontendStatuses((prev) => {
            if (prev[streamId] === status) return prev;
            return { ...prev, [streamId]: status };
        });
    }, []);

    const visibleFrontendStatuses = useMemo(() => {
        if (!snapshot) return frontendStatuses;
        // 削除済みストリームの再生状態を表示へ残さない。
        const streamIds = new Set(snapshot.streams.map((stream) => stream.id));
        return Object.fromEntries(Object.entries(frontendStatuses).filter(([streamId]) => streamIds.has(streamId)));
    }, [frontendStatuses, snapshot]);

    const content = useMemo(() => {
        if (error && !snapshot) {
            return <div className="min-h-screen bg-black p-5 text-white">API 接続エラー: {error}</div>;
        }
        if (!snapshot) {
            return <div className="min-h-screen bg-black p-5 text-white">読み込み中</div>;
        }
        return (
            <Routes>
                <Route path="/" element={<Navigate to="/settings" replace />} />
                <Route path="/main" element={<MainScreen snapshot={snapshot} frontendStatuses={visibleFrontendStatuses} reportStatus={reportStatus} serverStatus={serverStatus} />} />
                <Route path="/streams" element={<StreamsScreen snapshot={snapshot} frontendStatuses={visibleFrontendStatuses} reportStatus={reportStatus} serverStatus={serverStatus} />} />
                <Route path="/settings" element={<SettingsScreen snapshot={snapshot} refresh={refresh} serverStatus={serverStatus} />} />
            </Routes>
        );
    }, [error, refresh, reportStatus, serverStatus, snapshot, visibleFrontendStatuses]);

    return content;
}

export default App;
