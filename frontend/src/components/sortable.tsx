import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

type SortableHandleState = Pick<ReturnType<typeof useSortable>, "attributes" | "listeners" | "setActivatorNodeRef" | "isDragging">;

type SortableItemProps = {
    id: string;
    className?: string;
    children: (sortable: SortableHandleState) => ReactNode;
};

export function SortableItem({ id, className, children }: SortableItemProps) {
    const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
    const style: CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div ref={setNodeRef} style={style} className={cn(className, isDragging && "relative z-10 opacity-70")}>
            {children({ attributes, listeners, setActivatorNodeRef, isDragging })}
        </div>
    );
}

type DragHandleProps = SortableHandleState & {
    label: string;
};

export function DragHandle({ attributes, listeners, setActivatorNodeRef, label }: DragHandleProps) {
    return (
        <Button
            ref={setActivatorNodeRef}
            type="button"
            variant="ghost"
            size="icon-sm"
            className="cursor-grab touch-none active:cursor-grabbing"
            aria-label={label}
            // ドラッグ開始はこのハンドルだけに限定する。
            {...attributes}
            {...listeners}
        >
            <GripVertical />
        </Button>
    );
}
