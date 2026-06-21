import { statusDotClass, statusText } from "@/constants";
import { cn } from "@/lib/utils";
import type { ConnectionStatus } from "@/types";

type ServerStatusProps = {
    status: ConnectionStatus;
    className?: string;
};

export function ServerStatus({ status, className }: ServerStatusProps) {
    return (
        <span className={cn("inline-flex shrink-0 items-center gap-1.5 border border-border bg-card px-2 py-1 text-xs font-bold text-card-foreground", className)}>
            <span className={cn("size-2.5 shrink-0 rounded-full", statusDotClass(status))} title={`Server: ${statusText(status)}`} />
            Server: {statusText(status)}
        </span>
    );
}
