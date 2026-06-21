import { POSITIONS } from "@/constants";
import type { Position, Scene, ScenePayload, VideoStream } from "@/types";
import { arrayMove } from "@dnd-kit/sortable";

// 本番画面で位置からストリームを引ける形に変換する。
export function placementMap(scene: Scene | undefined): Map<Position, VideoStream> {
    return new Map(scene?.placements.map((placement) => [placement.position, placement.stream]));
}

// フォームの配置選択をAPIのpayloadに変換する。
export function scenePayloadFromForm(form: HTMLFormElement, streams: VideoStream[]): ScenePayload {
    const formData = new FormData(form);
    const knownStreamIds = new Set(streams.map((stream) => stream.id));
    const usedStreamIds = new Set<string>();
    const placements = POSITIONS.flatMap((position) => {
        const rawValue = formData.get(`position-${position}`);
        const streamId = rawValue === null || rawValue === "" || rawValue === "none" ? null : String(rawValue);
        if (streamId === null || !knownStreamIds.has(streamId) || usedStreamIds.has(streamId)) return [];
        usedStreamIds.add(streamId);
        return [{ position, stream_id: streamId }];
    });
    return {
        name: String(formData.get("name") ?? "").trim(),
        placements,
    };
}

// dnd-kitの移動結果を、保存用のID配列に変換する。
export function orderedIdsAfterDrag(ids: string[], activeId: string, overId: string): string[] | null {
    const oldIndex = ids.indexOf(activeId);
    const newIndex = ids.indexOf(overId);
    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return null;
    return arrayMove(ids, oldIndex, newIndex);
}
