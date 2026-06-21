import { statusDotClass, statusText } from "@/constants";
import { cn } from "@/lib/utils";
import type { ConnectionStatus, Snapshot, VideoStream } from "@/types";
import { ServerStatus } from "./ServerStatus";

type StatusStripProps = {
    title: string;
    streams: VideoStream[];
    snapshot: Snapshot;
    frontendStatuses: Record<string, ConnectionStatus>;
    serverStatus: ConnectionStatus;
};

export function StatusStrip({ title, streams, snapshot, frontendStatuses, serverStatus }: StatusStripProps) {
    return (
        <div className="flex shrink-0 items-center gap-2 overflow-x-auto bg-black/80 px-2.5 py-2 text-xs text-zinc-100">
            {title && <span className="shrink-0 font-extrabold">{title}</span>}
            <ServerStatus status={serverStatus} className="border-zinc-700 bg-zinc-950 text-zinc-100" />
            {streams.map((stream) => {
                const cameraStatus = snapshot.state.camera_statuses[stream.id] ?? "disconnected";
                const frontendStatus = frontendStatuses[stream.id] ?? "disconnected";
                return (
                    <span className="inline-flex shrink-0 items-center gap-1.5 border border-zinc-700 bg-zinc-950 px-2 py-1" key={stream.id}>
                        {stream.name}
                        <span className={cn("size-2.5 shrink-0 rounded-full", statusDotClass(cameraStatus))} title={`Camera-MediaMTX: ${statusText(cameraStatus)}`} />
                        <span className={cn("size-2.5 shrink-0 rounded-full", statusDotClass(frontendStatus))} title={`Frontend: ${statusText(frontendStatus)}`} />
                    </span>
                );
            })}
        </div>
    );
}
