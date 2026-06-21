import { createScene, createStream, deleteScene, deleteStream, updateActiveScene, updateScene, updateSceneOrder, updateStream, updateStreamOrder } from "@/api";
import { ServerStatus } from "@/components/display/ServerStatus";
import { SceneForm } from "@/components/settings/SceneForm";
import { DragHandle, SortableItem } from "@/components/sortable";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { statusDotClass, statusText } from "@/constants";
import { orderedIdsAfterDrag, scenePayloadFromForm } from "@/lib/scene-utils";
import { cn } from "@/lib/utils";
import type { ConnectionStatus, Snapshot } from "@/types";
import type { DragEndEvent } from "@dnd-kit/core";
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus, Save, Trash2 } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import { NavLink } from "react-router-dom";

type SettingsProps = {
    snapshot: Snapshot;
    refresh: () => Promise<void>;
    serverStatus: ConnectionStatus;
};

export function SettingsScreen({ snapshot, refresh, serverStatus }: SettingsProps) {
    const [error, setError] = useState<string | null>(null);
    const [isStreamModalOpen, setIsStreamModalOpen] = useState(false);
    const [isSceneModalOpen, setIsSceneModalOpen] = useState(false);
    const activeSceneId = snapshot.state.active_scene_id ?? "none";
    // キュー中の選択は、現在表示中シーンが変わったら同期し直す。
    const [sceneSelection, setSceneSelection] = useState({ activeSceneId, selectedSceneId: activeSceneId });
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
    const selectedSceneId = sceneSelection.activeSceneId === activeSceneId ? sceneSelection.selectedSceneId : activeSceneId;
    // キュー中のシーンが削除された場合は、現在の表示シーンに戻す。
    const selectedSceneExists = selectedSceneId === "none" || snapshot.scenes.some((scene) => scene.id === selectedSceneId);
    const queuedSceneId = selectedSceneExists ? selectedSceneId : activeSceneId;
    const canCueScene = queuedSceneId !== activeSceneId;
    const streamIdsUsedOutsideScene = (sceneId: string | null) => new Set(snapshot.scenes.flatMap((scene) => (scene.id === sceneId ? [] : scene.placements.map((placement) => placement.stream_id))));

    // API更新後は最新スナップショットを取り直す。
    const run = async (action: () => Promise<unknown>, afterAction?: () => void) => {
        try {
            setError(null);
            await action();
            afterAction?.();
            await refresh();
            return true;
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
            return false;
        }
    };

    const handleCreateStream = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        // HTMLフォームの値は必ず文字列化し、APIへ送る前に前後空白を落とす。
        const form = event.currentTarget;
        const formData = new FormData(event.currentTarget);
        await run(
            () =>
                createStream({
                    name: String(formData.get("name") ?? "").trim(),
                    mediamtx_path: String(formData.get("mediamtx_path") ?? "").trim(),
                }),
            () => {
                form.reset();
                setIsStreamModalOpen(false);
            },
        );
    };

    const handleUpdateStream = (streamId: string, event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        void run(() =>
            updateStream(streamId, {
                name: String(formData.get("name") ?? "").trim(),
                mediamtx_path: String(formData.get("mediamtx_path") ?? "").trim(),
            }),
        );
    };

    const handleCreateScene = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const form = event.currentTarget;
        const payload = scenePayloadFromForm(event.currentTarget, snapshot.streams);
        await run(
            () => createScene(payload),
            () => {
                form.reset();
                setIsSceneModalOpen(false);
            },
        );
    };

    const handleUpdateScene = (sceneId: string, event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const payload = scenePayloadFromForm(event.currentTarget, snapshot.streams);
        void run(() => updateScene(sceneId, payload));
    };

    // ドラッグ後の順序をそのまま保存する。
    const handleStreamDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over) return;
        const currentIds = snapshot.streams.map((stream) => stream.id);
        const orderedIds = orderedIdsAfterDrag(currentIds, String(active.id), String(over.id));
        if (orderedIds) {
            void run(() => updateStreamOrder(orderedIds));
        }
    };

    // ドラッグ後の順序をそのまま保存する。
    const handleSceneDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over) return;
        const currentIds = snapshot.scenes.map((scene) => scene.id);
        const orderedIds = orderedIdsAfterDrag(currentIds, String(active.id), String(over.id));
        if (orderedIds) {
            void run(() => updateSceneOrder(orderedIds));
        }
    };

    const handleCueScene = () => {
        // キューボタンを押した時だけ本番表示へ反映する。
        void run(() => updateActiveScene(queuedSceneId === "none" ? null : queuedSceneId));
    };

    return (
        <div className="h-screen overflow-auto bg-background text-foreground">
            <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
                <div className="flex flex-wrap items-center justify-end gap-3 px-6 py-3">
                    <nav className="flex gap-2">
                        <Button asChild variant="outline" size="sm">
                            <NavLink to="/main" target="_blank" rel="noopener noreferrer">
                                Main
                            </NavLink>
                        </Button>
                        <Button asChild variant="outline" size="sm">
                            <NavLink to="/streams" target="_blank" rel="noopener noreferrer">
                                Streams
                            </NavLink>
                        </Button>{" "}
                    </nav>
                    <ServerStatus status={serverStatus} />
                </div>
            </header>

            <main className="grid gap-5 px-6 py-5 lg:px-8 max-w-7xl mx-auto">
                {error && (
                    <Card>
                        <CardHeader>
                            <CardTitle>エラー</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-destructive">{error}</p>
                        </CardContent>
                    </Card>
                )}

                <Card>
                    <CardHeader>
                        <CardTitle>表示シーン</CardTitle>
                    </CardHeader>
                    <CardContent className="flex w-full flex-wrap items-start gap-2">
                        <div className="flex flex-1 flex-wrap gap-2">
                            <Button
                                type="button"
                                variant={queuedSceneId === "none" ? "default" : activeSceneId === "none" ? "secondary" : "outline"}
                                size="sm"
                                className={cn("h-10 w-32 justify-start px-2.5 py-1.5", activeSceneId === "none" && queuedSceneId !== "none" && "border-primary text-primary")}
                                onClick={() => setSceneSelection({ activeSceneId, selectedSceneId: "none" })}
                            >
                                <span className="grid min-w-0 text-left leading-tight">
                                    <span className="truncate">未選択</span>
                                    <span className="truncate text-xs opacity-70">{activeSceneId === "none" ? "表示中" : ""}</span>
                                </span>
                            </Button>
                            {snapshot.scenes.map((scene) => {
                                const isActive = activeSceneId === scene.id;
                                const isQueued = queuedSceneId === scene.id;
                                return (
                                    <Button
                                        key={scene.id}
                                        type="button"
                                        variant={isQueued ? "default" : isActive ? "secondary" : "outline"}
                                        size="sm"
                                        className={cn("h-10 w-32 justify-start px-2.5 py-1.5", isActive && !isQueued && "border-primary text-primary")}
                                        onClick={() => setSceneSelection({ activeSceneId, selectedSceneId: scene.id })}
                                    >
                                        <span className="grid min-w-0 text-left leading-tight">
                                            <span className="truncate">{scene.name}</span>
                                            <span className="truncate text-xs opacity-70">{isActive ? "表示中" : ""}</span>
                                        </span>
                                    </Button>
                                );
                            })}
                        </div>
                        <Button type="button" size="sm" className="ml-auto h-10 min-w-20" disabled={!canCueScene} onClick={handleCueScene}>
                            キュー
                        </Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>映像ストリーム</CardTitle>
                        <CardAction>
                            <Button size="sm" onClick={() => setIsStreamModalOpen(true)}>
                                <Plus />
                                新規作成
                            </Button>
                        </CardAction>
                    </CardHeader>
                    <CardContent className="overflow-x-auto">
                        <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={handleStreamDragEnd}>
                            <SortableContext items={snapshot.streams.map((stream) => stream.id)} strategy={verticalListSortingStrategy}>
                                <div className="grid min-w-170 gap-2">
                                    <div className="grid grid-cols-[minmax(160px,1fr)_minmax(180px,1fr)_9rem_auto_2.5rem] items-center gap-3 px-3 text-xs font-medium text-muted-foreground">
                                        <span>ソース名</span>
                                        <span>MediaMTX パス</span>
                                        <span>状態</span>
                                        <span>操作</span>
                                    </div>
                                    {snapshot.streams.map((stream) => {
                                        const cameraStatus = snapshot.state.camera_statuses[stream.id] ?? "disconnected";
                                        return (
                                            <SortableItem
                                                key={stream.id}
                                                id={stream.id}
                                                className="grid grid-cols-[minmax(160px,1fr)_minmax(180px,1fr)_9rem_auto_2.5rem] items-center gap-3 rounded-sm border bg-card px-3 py-2"
                                            >
                                                {(sortable) => (
                                                    <>
                                                        <form id={`stream-${stream.id}`} className="contents" onSubmit={(event) => handleUpdateStream(stream.id, event)}>
                                                            <Input name="name" defaultValue={stream.name} required />
                                                            <Input name="mediamtx_path" defaultValue={stream.mediamtx_path} required />
                                                        </form>
                                                        <span className="inline-flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
                                                            <span
                                                                className={cn("size-2.5 shrink-0 rounded-full", statusDotClass(cameraStatus))}
                                                                title={`Camera-MediaMTX: ${statusText(cameraStatus)}`}
                                                            />
                                                            <span className="truncate">{statusText(cameraStatus)}</span>
                                                        </span>
                                                        <div className="flex justify-end gap-1">
                                                            <Button form={`stream-${stream.id}`} type="submit" variant="outline" size="icon-sm">
                                                                <Save />
                                                            </Button>
                                                            <Button type="button" variant="destructive" size="icon-sm" onClick={() => void run(() => deleteStream(stream.id))}>
                                                                <Trash2 />
                                                            </Button>
                                                        </div>
                                                        <DragHandle {...sortable} label={`${stream.name} の表示順をドラッグして変更`} />
                                                    </>
                                                )}
                                            </SortableItem>
                                        );
                                    })}
                                </div>
                            </SortableContext>
                        </DndContext>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>シーン</CardTitle>
                        <CardAction>
                            <Button size="sm" onClick={() => setIsSceneModalOpen(true)}>
                                <Plus />
                                新規作成
                            </Button>
                        </CardAction>
                    </CardHeader>
                    <CardContent>
                        <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={handleSceneDragEnd}>
                            <SortableContext items={snapshot.scenes.map((scene) => scene.id)} strategy={verticalListSortingStrategy}>
                                <div className="grid gap-3">
                                    {snapshot.scenes.map((scene) => (
                                        <SortableItem key={scene.id} id={scene.id}>
                                            {(sortable) => (
                                                <SceneForm
                                                    scene={scene}
                                                    streams={snapshot.streams}
                                                    unavailableStreamIds={streamIdsUsedOutsideScene(scene.id)}
                                                    onSubmit={(event) => handleUpdateScene(scene.id, event)}
                                                    onDelete={() => void run(() => deleteScene(scene.id))}
                                                    orderControls={<DragHandle {...sortable} label={`${scene.name} の表示順をドラッグして変更`} />}
                                                    submitLabel="保存"
                                                />
                                            )}
                                        </SortableItem>
                                    ))}
                                </div>
                            </SortableContext>
                        </DndContext>
                    </CardContent>
                </Card>
            </main>

            <Dialog open={isStreamModalOpen} onOpenChange={setIsStreamModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>新規ストリーム</DialogTitle>
                    </DialogHeader>
                    <form className="grid gap-4" onSubmit={handleCreateStream}>
                        <div className="grid gap-2">
                            <Label htmlFor="stream-name">Name</Label>
                            <Input id="stream-name" name="name" placeholder="Camera 1" required autoFocus />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="stream-path">MediaMTX パス</Label>
                            <Input id="stream-path" name="mediamtx_path" placeholder="cam1-main" required />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsStreamModalOpen(false)}>
                                キャンセル
                            </Button>
                            <Button type="submit">追加</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={isSceneModalOpen} onOpenChange={setIsSceneModalOpen}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>新規シーン</DialogTitle>
                    </DialogHeader>
                    <SceneForm streams={snapshot.streams} unavailableStreamIds={streamIdsUsedOutsideScene(null)} onSubmit={handleCreateScene} submitLabel="追加" isModalForm />
                </DialogContent>
            </Dialog>
        </div>
    );
}
