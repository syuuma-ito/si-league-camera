import type { ConnectionStatus, Snapshot } from "@/types";

export type ScreenProps = {
    snapshot: Snapshot;
    frontendStatuses: Record<string, ConnectionStatus>;
    reportStatus: (streamId: string, status: ConnectionStatus) => void;
    serverStatus: ConnectionStatus;
};

