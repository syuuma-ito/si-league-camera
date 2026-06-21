import { cn } from "@/lib/utils";
import { Maximize2 } from "lucide-react";
import { useEffect, useState, type RefObject } from "react";

type FullscreenButtonProps = {
    targetRef: RefObject<HTMLElement | null>;
};

export function FullscreenButton({ targetRef }: FullscreenButtonProps) {
    const [isFullscreen, setIsFullscreen] = useState(false);

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(document.fullscreenElement === targetRef.current);
        };

        handleFullscreenChange();
        document.addEventListener("fullscreenchange", handleFullscreenChange);
        return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
    }, [targetRef]);

    const enterFullscreen = () => {
        const target = targetRef.current;
        if (!target) return;

        void target.requestFullscreen();
    };

    if (isFullscreen) {
        return null;
    }

    return (
        <button
            type="button"
            className={cn(
                "absolute top-3 right-3 z-30 inline-flex size-10 items-center justify-center border border-zinc-700 bg-black/75 text-zinc-100 shadow-sm backdrop-blur transition-colors",
                "hover:bg-zinc-900 focus-visible:border-zinc-300 focus-visible:ring-3 focus-visible:ring-zinc-300/30 focus-visible:outline-none",
            )}
            onClick={enterFullscreen}
            aria-label="全画面表示"
            title="全画面表示"
        >
            <Maximize2 className="size-5" />
        </button>
    );
}
