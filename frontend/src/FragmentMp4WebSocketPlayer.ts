import type { ConnectionStatus } from "@/types";

const MIME_TYPE = 'video/mp4; codecs="avc1.420028,mp4a.40.2"';

export class FragmentMp4WebSocketPlayer {
    private videoEl: HTMLVideoElement;
    private wsUrl: string;
    private mediaSource: MediaSource | null = null;
    private sourceBuffer: SourceBuffer | null = null;
    private websocket: WebSocket | null = null;
    private objectUrl: string | null = null;
    private queue: ArrayBuffer[] = [];
    private stopped = false;
    private debugEnabled = import.meta.env.DEV || import.meta.env.VITE_FMP4_WS_DEBUG === "true";

    onStatusChange: ((status: ConnectionStatus) => void) | null = null;

    private static readonly MAX_BUFFER_SECONDS = 30;
    private static readonly KEEP_BUFFER_SECONDS = 20;

    constructor(videoEl: HTMLVideoElement, wsUrl: string) {
        this.videoEl = videoEl;
        this.wsUrl = wsUrl;
    }

    private log(message: string, type = "info") {
        if (this.debugEnabled) {
            console.debug(`[fMP4 WS: ${this.wsUrl}] [${type}] ${message}`);
        }
    }

    start() {
        if (this.mediaSource || this.websocket) return;

        this.stopped = false;
        this.setStatus("connecting");

        if (!MediaSource.isTypeSupported(MIME_TYPE)) {
            this.log(`Unsupported MIME type: ${MIME_TYPE}`, "error");
            this.setStatus("disconnected");
            return;
        }

        this.mediaSource = new MediaSource();
        this.objectUrl = URL.createObjectURL(this.mediaSource);
        this.videoEl.src = this.objectUrl;
        this.videoEl.addEventListener("playing", this.handlePlaying);
        this.mediaSource.addEventListener("sourceopen", this.handleSourceOpen, { once: true });
    }

    private handleSourceOpen = () => {
        if (this.stopped || !this.mediaSource) return;

        if (this.objectUrl) {
            URL.revokeObjectURL(this.objectUrl);
            this.objectUrl = null;
        }

        try {
            this.sourceBuffer = this.mediaSource.addSourceBuffer(MIME_TYPE);
            this.sourceBuffer.mode = "sequence";
            this.sourceBuffer.addEventListener("updateend", this.appendNext);
        } catch (err) {
            this.log(err instanceof Error ? err.message : String(err), "error");
            this.setStatus("disconnected");
            this.stop();
            return;
        }

        this.websocket = new WebSocket(this.wsUrl);
        this.websocket.binaryType = "arraybuffer";
        this.websocket.onmessage = (event) => {
            if (this.stopped || !(event.data instanceof ArrayBuffer)) return;
            this.queue.push(event.data);
            this.appendNext();
        };
        this.websocket.onerror = () => {
            this.setStatus("disconnected");
        };
        this.websocket.onclose = () => {
            if (!this.stopped) {
                this.setStatus("disconnected");
            }
        };
    };

    private handlePlaying = () => {
        this.setStatus("connected");
    };

    private appendNext = () => {
        if (!this.sourceBuffer || this.sourceBuffer.updating || this.queue.length === 0) return;

        if (this.removeOldBuffer()) return;

        const nextSegment = this.queue.shift();
        if (!nextSegment) return;

        try {
            this.sourceBuffer.appendBuffer(nextSegment);
        } catch (err) {
            this.log(err instanceof Error ? err.message : String(err), "error");
            this.setStatus("disconnected");
        }
    };

    private removeOldBuffer() {
        if (!this.sourceBuffer) return false;

        const buffered = this.sourceBuffer.buffered;
        if (buffered.length === 0) return false;

        const start = buffered.start(0);
        const end = buffered.end(buffered.length - 1);
        if (end - start <= FragmentMp4WebSocketPlayer.MAX_BUFFER_SECONDS) return false;

        try {
            this.sourceBuffer.remove(start, end - FragmentMp4WebSocketPlayer.KEEP_BUFFER_SECONDS);
            return true;
        } catch (err) {
            this.log(err instanceof Error ? err.message : String(err), "warn");
            return false;
        }
    }

    private setStatus(status: ConnectionStatus) {
        this.onStatusChange?.(status);
    }

    stop() {
        this.stopped = true;
        this.videoEl.removeEventListener("playing", this.handlePlaying);

        if (this.websocket) {
            this.websocket.onmessage = null;
            this.websocket.onerror = null;
            this.websocket.onclose = null;
            this.websocket.close();
            this.websocket = null;
        }

        if (this.sourceBuffer) {
            this.sourceBuffer.removeEventListener("updateend", this.appendNext);
            this.sourceBuffer = null;
        }

        if (this.mediaSource) {
            try {
                if (this.mediaSource.readyState === "open") {
                    this.mediaSource.endOfStream();
                }
            } catch {
                // 破棄中のMediaSource状態差分は無視する
            }
            this.mediaSource = null;
        }

        if (this.objectUrl) {
            URL.revokeObjectURL(this.objectUrl);
            this.objectUrl = null;
        }

        this.queue = [];
        this.videoEl.removeAttribute("src");
        this.videoEl.load();
        this.setStatus("disconnected");
    }
}
