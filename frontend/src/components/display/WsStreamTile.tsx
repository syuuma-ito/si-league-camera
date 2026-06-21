import { FragmentMp4WebSocketPlayer } from "@/FragmentMp4WebSocketPlayer";
import { statusText } from "@/constants";
import type { ConnectionStatus, VideoStream } from "@/types";
import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";

type WsStreamTileProps = {
    stream: VideoStream | null;
    wsUrl?: string;
    wsMapError?: string | null;
    gridArea?: string;
    frontendStatus?: ConnectionStatus;
    reportStatus: (streamId: string, status: ConnectionStatus) => void;
};

export function WsStreamTile({ stream, wsUrl, wsMapError = null, gridArea, frontendStatus = "disconnected", reportStatus }: WsStreamTileProps) {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const lastReportedStatusRef = useRef<ConnectionStatus | null>(null);
    const streamId = stream?.id ?? null;
    const playbackKey = `${streamId ?? ""}:${wsUrl ?? ""}`;
    const [localStatus, setLocalStatus] = useState<{ key: string; status: ConnectionStatus } | null>(null);
    const tileStyle: CSSProperties | undefined = gridArea ? { gridArea } : undefined;

    useEffect(() => {
        lastReportedStatusRef.current = frontendStatus;
    }, [frontendStatus, streamId]);

    useEffect(() => {
        if (streamId === null || !wsUrl || !videoRef.current) return undefined;

        const player = new FragmentMp4WebSocketPlayer(videoRef.current, wsUrl);
        player.onStatusChange = (status) => {
            setLocalStatus({ key: playbackKey, status });
            if (lastReportedStatusRef.current !== status) {
                lastReportedStatusRef.current = status;
                reportStatus(streamId, status);
            }
        };
        player.start();

        return () => {
            player.onStatusChange = null;
            player.stop();
        };
    }, [playbackKey, reportStatus, streamId, wsUrl]);

    if (!stream) {
        return (
            <div className="relative min-h-0 min-w-0 overflow-hidden bg-black" style={tileStyle}>
                <div className="absolute inset-0 grid place-content-center gap-2 bg-[#050505] text-center text-[28px] font-bold text-zinc-300" />
            </div>
        );
    }

    const currentLocalStatus = localStatus?.key === playbackKey ? localStatus.status : null;
    const status = wsUrl ? (currentLocalStatus ?? frontendStatus) : "disconnected";
    const label = wsMapError ?? (wsUrl ? statusText(status) : "WSマップ未設定");

    return (
        <div className="relative min-h-0 min-w-0 overflow-hidden bg-black" style={tileStyle}>
            <video className="block h-full w-full bg-black object-contain" ref={videoRef} autoPlay muted playsInline />
            {status !== "connected" && (
                <div className="absolute inset-0 grid place-content-center gap-2 bg-[#050505] text-center text-[28px] font-bold text-zinc-300">
                    <div>{stream.name}</div>
                    <span className="text-sm font-semibold text-zinc-500">{label}</span>
                </div>
            )}
        </div>
    );
}
