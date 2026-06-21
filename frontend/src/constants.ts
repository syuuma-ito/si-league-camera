import type { ConnectionStatus, Position } from "./types";

export const POSITIONS: Position[] = ["top-left", "top-right", "bottom-left", "bottom-right"];

export const POSITION_LABELS: Record<Position, string> = {
    "top-left": "左上",
    "top-right": "右上",
    "bottom-left": "左下",
    "bottom-right": "右下",
};

export function statusText(status: ConnectionStatus): string {
    if (status === "connected") return "接続中";
    if (status === "connecting") return "接続試行中";
    return "切断";
}

export function statusDotClass(status: ConnectionStatus): string {
    if (status === "connected") return "bg-green-500";
    if (status === "connecting") return "bg-yellow-500";
    return "bg-zinc-500";
}
