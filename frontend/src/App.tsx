import { useEffect, useRef, useState } from "react";
import "./App.css";
import type { ConnectionStatus } from "./WHEPPlayer";
import { WHEPPlayer } from "./WHEPPlayer";

const MEDIA_SERVER = "localhost:8889";

const CAMERAS = [
    { path: "cam1-main", label: "1" },
    { path: "cam2-main", label: "2" },
    { path: "cam3-main", label: "3" },
    { path: "cam4-main", label: "4" },
    { path: "cam5-main", label: "5" },
    { path: "cam6-main", label: "6" },
    { path: "cam7-main", label: "7" },
    { path: "cam8-main", label: "8" },
] as const;

function App() {
    const [activeGroup, setActiveGroup] = useState<"A" | "B">("A");
    const [statuses, setStatuses] = useState<ConnectionStatus[]>(() => CAMERAS.map(() => "disconnected"));

    // 各ビデオ要素への参照
    const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

    // 接続インスタンスを保持するref
    const playersRef = useRef<WHEPPlayer[]>([]);

    const setRefAt = (index: number) => (el: HTMLVideoElement | null) => {
        videoRefs.current[index] = el;
    };

    useEffect(() => {
        const players = CAMERAS.map((cam, i) => {
            const videoEl = videoRefs.current[i];
            if (!videoEl) return null;

            const player = new WHEPPlayer(videoEl, cam.path, MEDIA_SERVER);
            player.onStatusChange = (status) => {
                setStatuses((prev) => {
                    const next = [...prev];
                    next[i] = status;
                    return next;
                });
            };
            player.start();
            return player;
        }).filter((p): p is WHEPPlayer => p !== null);

        playersRef.current = players;

        return () => {
            playersRef.current.forEach((player) => player.stop());
            playersRef.current = [];
        };
    }, []);

    return (
        <div className="app-viewport">
            <div className={`grid-container ${activeGroup === "A" ? "active" : ""}`}>
                <video ref={setRefAt(0)} autoPlay muted playsInline></video>
                <video ref={setRefAt(1)} autoPlay muted playsInline></video>
                <video ref={setRefAt(2)} autoPlay muted playsInline></video>
                <video ref={setRefAt(3)} autoPlay muted playsInline></video>
            </div>

            <div className={`grid-container ${activeGroup === "B" ? "active" : ""}`}>
                <video ref={setRefAt(4)} autoPlay muted playsInline></video>
                <video ref={setRefAt(5)} autoPlay muted playsInline></video>
                <video ref={setRefAt(6)} autoPlay muted playsInline></video>
                <video ref={setRefAt(7)} autoPlay muted playsInline></video>
            </div>

            <div className="bottom-bar">
                <div className="button-bar">
                    <button className={activeGroup === "A" ? "active" : ""} onClick={() => setActiveGroup("A")}>
                        1-4
                    </button>
                    <button className={activeGroup === "B" ? "active" : ""} onClick={() => setActiveGroup("B")}>
                        5-8
                    </button>
                    <div className="status-bar">
                        {CAMERAS.map((cam, i) => (
                            <div key={cam.path} className={`status-item status-${statuses[i]}`}>
                                <span className="status-dot" />
                                <span className="status-label">{cam.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default App;
