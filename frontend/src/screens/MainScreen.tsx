import { FullscreenButton } from "@/components/display/FullscreenButton";
import { StatusStrip } from "@/components/display/StatusStrip";
import { StreamTile } from "@/components/display/StreamTile";
import { POSITIONS } from "@/constants";
import { placementMap } from "@/lib/scene-utils";
import type { VideoStream } from "@/types";
import { useRef, type CSSProperties } from "react";
import type { ScreenProps } from "./screen-types";

const mainGridStyle: CSSProperties = {
    gridTemplateAreas: '"top-left top-right" "bottom-left bottom-right"',
};

export function MainScreen({ snapshot, frontendStatuses, reportStatus, serverStatus }: ScreenProps) {
    const screenRef = useRef<HTMLDivElement | null>(null);
    const activeScene = snapshot.scenes.find((scene) => scene.id === snapshot.state.active_scene_id);
    const streamsByPosition = placementMap(activeScene);
    // ステータス表示は画面の位置順に並べる
    const displayedStreams = POSITIONS.map((position) => streamsByPosition.get(position)).filter((stream): stream is VideoStream => stream !== undefined);
    const title = activeScene ? `Scene: ${activeScene.name}` : "Scene 未選択";

    return (
        <div ref={screenRef} className="relative flex h-screen w-screen flex-col overflow-hidden bg-black text-white">
            <div className="grid min-h-0 w-full flex-1 grid-cols-2 grid-rows-2" style={mainGridStyle}>
                {POSITIONS.map((position) => {
                    const stream = streamsByPosition.get(position) ?? null;
                    return (
                        <StreamTile
                            key={position}
                            stream={stream}
                            gridArea={position}
                            frontendStatus={stream ? frontendStatuses[stream.id] : undefined}
                            reportStatus={reportStatus}
                        />
                    );
                })}
            </div>
            <FullscreenButton targetRef={screenRef} />
            <StatusStrip title={title} streams={displayedStreams} snapshot={snapshot} frontendStatuses={frontendStatuses} serverStatus={serverStatus} />
        </div>
    );
}
