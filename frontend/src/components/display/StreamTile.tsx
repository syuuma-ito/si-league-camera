import { MEDIA_SERVER } from "@/api";
import { statusText } from "@/constants";
import type { ConnectionStatus, Position, VideoStream } from "@/types";
import type { ConnectionStatus as PlayerStatus } from "@/WebRTCPlayer";
import { WebRTCPlayer } from "@/WebRTCPlayer";
import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";

type StreamTileProps = {
    stream: VideoStream | null;
    gridArea?: Position;
    frontendStatus?: ConnectionStatus;
    reportStatus: (streamId: string, status: ConnectionStatus) => void;
};

export function StreamTile({ stream, gridArea, frontendStatus = "disconnected", reportStatus }: StreamTileProps) {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const lastReportedStatusRef = useRef<ConnectionStatus | null>(null);
    const [localStatus, setLocalStatus] = useState<ConnectionStatus | null>(null);
    const streamId = stream?.id ?? null;
    const streamPath = stream?.mediamtx_path ?? null;
    const tileStyle: CSSProperties | undefined = gridArea ? { gridArea } : undefined;

    // 外部から届いた状態を、重複通知の抑止に使う。
    useEffect(() => {
        lastReportedStatusRef.current = frontendStatus;
    }, [frontendStatus, streamId]);

    // ストリームが変わったらWebRTC接続を作り直す。
    useEffect(() => {
        if (streamId === null || streamPath === null || !videoRef.current) return undefined;

        const player = new WebRTCPlayer(videoRef.current, MEDIA_SERVER, streamPath);
        player.onStatusChange = (status: PlayerStatus) => {
            setLocalStatus(status);
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
    }, [reportStatus, streamId, streamPath]);

    if (!stream) {
        return (
            <div className="relative min-h-0 min-w-0 overflow-hidden bg-black" style={tileStyle}>
                <div className="absolute inset-0 grid place-content-center gap-2 bg-[#050505] text-center text-[28px] font-bold text-zinc-300" />
            </div>
        );
    }

    return (
        <div className="relative min-h-0 min-w-0 overflow-hidden bg-black" style={tileStyle}>
            <video className="block h-full w-full bg-black object-contain" ref={videoRef} autoPlay muted playsInline />
            {(localStatus ?? frontendStatus) !== "connected" && (
                <div className="absolute inset-0 grid place-content-center gap-2 bg-[#050505] text-center text-[28px] font-bold text-zinc-300">
                    <div>{stream.name}</div>
                    <span className="text-sm font-semibold text-zinc-500">{statusText(localStatus ?? frontendStatus)}</span>
                </div>
            )}
        </div>
    );
}
