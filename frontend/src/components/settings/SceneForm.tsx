import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { POSITION_LABELS, POSITIONS } from "@/constants";
import { placementMap } from "@/lib/scene-utils";
import type { Position, Scene, VideoStream } from "@/types";
import { Save, Trash2 } from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { useMemo, useState } from "react";

type SceneFormProps = {
    scene?: Scene;
    streams: VideoStream[];
    unavailableStreamIds?: Set<string>;
    submitLabel: string;
    onSubmit: (event: FormEvent<HTMLFormElement>) => void;
    onDelete?: () => void;
    orderControls?: ReactNode;
    isModalForm?: boolean;
};

export function SceneForm({ scene, streams, unavailableStreamIds = new Set(), submitLabel, onSubmit, onDelete, orderControls, isModalForm = false }: SceneFormProps) {
    // 配置がサーバ更新で変わった時だけ、フォーム内部の選択状態を初期化する。
    const signature = scene?.placements.map((placement) => `${placement.position}:${placement.stream_id}`).join("|") ?? "new";
    const initialPositions = useMemo(() => {
        const current = placementMap(scene);
        return Object.fromEntries(POSITIONS.map((position) => [position, current.get(position)?.id ?? "none"])) as Record<Position, string>;
    }, [scene]);
    const [selection, setSelection] = useState({ signature, positions: initialPositions });
    const selectedPositions = selection.signature === signature ? selection.positions : initialPositions;
    const selectedStreamIds = useMemo(() => new Set(Object.values(selectedPositions).filter((streamId) => streamId !== "none")), [selectedPositions]);

    const updateSelectedPosition = (position: Position, streamId: string) => {
        // 同じストリームを複数枠に置けないよう、選択状態は枠ごとに一元管理する。
        setSelection({
            signature,
            positions: {
                ...selectedPositions,
                [position]: streamId,
            },
        });
    };

    return (
        <form key={`${scene?.id ?? "new"}-${signature}`} className={isModalForm ? "grid gap-4" : ""} onSubmit={onSubmit}>
            <Card size="sm" className={isModalForm ? "border-0 bg-transparent p-0 ring-0" : ""}>
                <CardHeader className={isModalForm ? "hidden" : ""}>
                    <CardTitle className="flex items-center gap-2">{scene?.name ?? "新規シーン"}</CardTitle>
                    <CardAction className="flex gap-1">
                        <Button type="submit" variant="outline" size="icon-sm">
                            <Save />
                        </Button>
                        {onDelete && (
                            <Button type="button" variant="destructive" size="icon-sm" onClick={onDelete}>
                                <Trash2 />
                            </Button>
                        )}
                        {orderControls}
                    </CardAction>
                </CardHeader>
                <CardContent className={isModalForm ? "grid gap-4 p-0" : "grid gap-4"}>
                    <div className="grid grid-cols-[5rem_minmax(0,1fr)] items-center gap-2">
                        <Label htmlFor={`scene-name-${scene?.id ?? "new"}`}>シーン名</Label>
                        <Input id={`scene-name-${scene?.id ?? "new"}`} name="name" defaultValue={scene?.name ?? ""} placeholder="シーン名" required />
                    </div>
                    <Separator />
                    <div className="grid grid-cols-2 gap-3">
                        {POSITIONS.map((position) => (
                            <div className="grid grid-cols-[3rem_minmax(0,1fr)] items-center gap-3" key={position}>
                                <Label>{POSITION_LABELS[position]}</Label>
                                {/* shadcn Selectの値をFormDataで送るためにhidden inputへ同期する。 */}
                                <input type="hidden" name={`position-${position}`} value={selectedPositions[position]} />
                                <Select value={selectedPositions[position]} onValueChange={(value) => updateSelectedPosition(position, value)}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="未配置" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">未配置</SelectItem>
                                        {streams.map((stream) => {
                                            const selectedInThisPosition = selectedPositions[position] === stream.id;
                                            const selectedInAnotherPosition = selectedStreamIds.has(stream.id) && !selectedInThisPosition;
                                            const selectedInAnotherScene = unavailableStreamIds.has(stream.id) && !selectedInThisPosition;
                                            const isUnavailable = selectedInAnotherPosition || selectedInAnotherScene;
                                            return (
                                                <SelectItem key={stream.id} value={stream.id} disabled={isUnavailable}>
                                                    <span className="flex w-full min-w-0 items-center justify-between gap-4">
                                                        <span className="truncate">{stream.name}</span>
                                                        {isUnavailable && <span className="shrink-0 text-xs text-muted-foreground">選択済み</span>}
                                                    </span>
                                                </SelectItem>
                                            );
                                        })}
                                    </SelectContent>
                                </Select>
                            </div>
                        ))}
                    </div>
                    {isModalForm && (
                        <DialogFooter>
                            <Button type="submit">{submitLabel}</Button>
                        </DialogFooter>
                    )}
                </CardContent>
            </Card>
        </form>
    );
}
