import { FullscreenButton } from "@/components/display/FullscreenButton";
import { StatusStrip } from "@/components/display/StatusStrip";
import { WsStreamTile } from "@/components/display/WsStreamTile";
import type { FragmentMp4WsMap } from "@/types";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { ScreenProps } from "./screen-types";

type StreamsWsScreenProps = ScreenProps & {
    wsMap: FragmentMp4WsMap;
    wsMapError: string | null;
};

type Size = {
    width: number;
    height: number;
};

const streamAspectRatio = 16 / 9;

function bestStreamGrid(streamCount: number, size: Size) {
    if (streamCount <= 0 || size.width <= 0 || size.height <= 0) {
        return { columns: 1, rows: 1 };
    }

    let best = { columns: 1, rows: streamCount, score: 0, emptyCells: 0 };

    for (let columns = 1; columns <= streamCount; columns += 1) {
        const rows = Math.ceil(streamCount / columns);
        const cellWidth = size.width / columns;
        const cellHeight = size.height / rows;
        const videoWidth = Math.min(cellWidth, cellHeight * streamAspectRatio);
        const videoHeight = videoWidth / streamAspectRatio;
        const emptyCells = columns * rows - streamCount;
        const score = videoWidth * videoHeight;

        if (score > best.score || (score === best.score && emptyCells < best.emptyCells)) {
            best = { columns, rows, score, emptyCells };
        }
    }

    return { columns: best.columns, rows: best.rows };
}

export function StreamsWsScreen({ snapshot, frontendStatuses, reportStatus, serverStatus, wsMap, wsMapError }: StreamsWsScreenProps) {
    const screenRef = useRef<HTMLDivElement | null>(null);
    const gridRef = useRef<HTMLDivElement | null>(null);
    const [gridSize, setGridSize] = useState<Size>({ width: 0, height: 0 });
    const grid = useMemo(() => bestStreamGrid(snapshot.streams.length, gridSize), [gridSize, snapshot.streams.length]);
    const gridStyle: CSSProperties = {
        gridTemplateColumns: `repeat(${grid.columns}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${grid.rows}, minmax(0, 1fr))`,
    };

    useEffect(() => {
        const target = gridRef.current;
        if (!target) return undefined;

        const observer = new ResizeObserver(([entry]) => {
            setGridSize({
                width: entry.contentRect.width,
                height: entry.contentRect.height,
            });
        });
        observer.observe(target);

        return () => observer.disconnect();
    }, []);

    return (
        <div ref={screenRef} className="relative flex h-screen w-screen flex-col overflow-hidden bg-black text-white">
            <div ref={gridRef} className="grid min-h-0 w-full flex-1" style={gridStyle}>
                {snapshot.streams.map((stream) => (
                    <WsStreamTile key={stream.id} stream={stream} wsUrl={wsMap[stream.mediamtx_path]} wsMapError={wsMapError} frontendStatus={frontendStatuses[stream.id]} reportStatus={reportStatus} />
                ))}
            </div>
            <FullscreenButton targetRef={screenRef} />
            <StatusStrip title="" streams={snapshot.streams} snapshot={snapshot} frontendStatuses={frontendStatuses} serverStatus={serverStatus} />
        </div>
    );
}
