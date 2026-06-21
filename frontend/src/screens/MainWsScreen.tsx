import { FullscreenButton } from "@/components/display/FullscreenButton";
import { StatusStrip } from "@/components/display/StatusStrip";
import { WsStreamTile } from "@/components/display/WsStreamTile";
import { POSITIONS } from "@/constants";
import { placementMap } from "@/lib/scene-utils";
import type { FragmentMp4WsMap, VideoStream } from "@/types";
import { useRef, type CSSProperties } from "react";
import type { ScreenProps } from "./screen-types";

type MainWsScreenProps = ScreenProps & {
    wsMap: FragmentMp4WsMap;
    wsMapError: string | null;
};

const mainGridStyle: CSSProperties = {
    gridTemplateAreas: '"top-left top-right" "bottom-left bottom-right"',
};

export function MainWsScreen({ snapshot, frontendStatuses, reportStatus, serverStatus, wsMap, wsMapError }: MainWsScreenProps) {
    const screenRef = useRef<HTMLDivElement | null>(null);
    const activeScene = snapshot.scenes.find((scene) => scene.id === snapshot.state.active_scene_id);
    const streamsByPosition = placementMap(activeScene);
    const displayedStreams = POSITIONS.map((position) => streamsByPosition.get(position)).filter((stream): stream is VideoStream => stream !== undefined);
    const title = activeScene ? `Scene: ${activeScene.name}` : "Scene 未選択";

    return (
        <div ref={screenRef} className="relative flex h-screen w-screen flex-col overflow-hidden bg-black text-white">
            <div className="grid min-h-0 w-full flex-1 grid-cols-2 grid-rows-2" style={mainGridStyle}>
                {POSITIONS.map((position) => {
                    const stream = streamsByPosition.get(position) ?? null;
                    return (
                        <WsStreamTile
                            key={position}
                            stream={stream}
                            wsUrl={stream ? wsMap[stream.mediamtx_path] : undefined}
                            wsMapError={wsMapError}
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
