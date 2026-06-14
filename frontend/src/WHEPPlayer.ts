export type ConnectionStatus = "connecting" | "connected" | "disconnected" | "retrying";

export class WHEPPlayer {
    private videoEl: HTMLVideoElement;
    private streamPath: string;
    private whepUrl: string;
    private pc: RTCPeerConnection | null = null;
    private reconnectTimer: number | null = null;
    private isConnecting = false;
    private stopped = false;

    onStatusChange: ((status: ConnectionStatus) => void) | null = null;

    private static readonly RETRY_DELAY_MS = 2000;
    private static readonly ICE_GATHER_TIMEOUT_MS = 3000;

    constructor(videoEl: HTMLVideoElement, streamPath: string, mediaServer: string) {
        this.videoEl = videoEl;
        this.streamPath = streamPath;
        this.whepUrl = `http://${mediaServer}/${streamPath}/whep`;
    }

    private log(message: string, type = "info") {
        console.log(`[WHEP:${this.streamPath}] [${type}] ${message}`);
    }

    async start() {
        if (this.isConnecting || this.pc) return;

        this.stopped = false;
        this.isConnecting = true;
        this.setStatus("connecting");
        this.log("Connecting to stream...", "status");

        try {
            this.pc = new RTCPeerConnection({
                iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
            });

            // WebRTC接続状態の監視
            this.pc.onconnectionstatechange = () => {
                const state = this.pc?.connectionState;
                this.log(`Connection state: ${state}`, "state");
                if (state === "failed" || state === "closed") {
                    this.scheduleReconnect(`Connection ${state}`);
                }
            };

            // ICE接続状態の監視
            this.pc.oniceconnectionstatechange = () => {
                const state = this.pc?.iceConnectionState;
                this.log(`ICE state: ${state}`, "state");
                if (state === "failed") {
                    this.scheduleReconnect("ICE connection failed");
                }
            };

            // リモートからトラックを受信した時の処理
            this.pc.ontrack = (event) => {
                if (this.videoEl.srcObject !== event.streams[0]) {
                    this.videoEl.srcObject = event.streams[0];
                    this.setStatus("connected");
                    this.log("Stream attached", "success");
                }
            };

            // 映像と音声の受信トランシーバーを登録
            this.pc.addTransceiver("video", { direction: "recvonly" });
            this.pc.addTransceiver("audio", { direction: "recvonly" });

            // SDP Offerを作成してローカル設定
            const offer = await this.pc.createOffer();
            await this.pc.setLocalDescription(offer);

            // ICE Candidateの収集完了を待機（タイムアウト付き）
            await this.waitForIceGathering();

            this.log("Sending SDP Offer...", "sdp");

            // WHEP APIに SDP Offerを送信
            const response = await fetch(this.whepUrl, {
                method: "POST",
                headers: { "Content-Type": "application/sdp" },
                body: this.pc.localDescription?.sdp ?? "",
            });

            if (!response.ok) {
                throw new Error(`WHEP request failed (${response.status})`);
            }

            // SDP Answerを適用
            const answerSdp = await response.text();
            this.log("SDP Answer received", "sdp");

            await this.pc.setRemoteDescription(new RTCSessionDescription({ type: "answer", sdp: answerSdp }));

            this.isConnecting = false;
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            this.log(`Setup error: ${message}`, "error");
            this.isConnecting = false;
            this.scheduleReconnect(message);
        }
    }

    /** ICE候補の収集完了をタイムアウト付きで待機 */
    private waitForIceGathering(): Promise<void> {
        return new Promise((resolve) => {
            if (this.pc?.iceGatheringState === "complete") {
                resolve();
                return;
            }

            const onStateChange = () => {
                if (this.pc?.iceGatheringState === "complete") {
                    this.pc.removeEventListener("icegatheringstatechange", onStateChange);
                    clearTimeout(timeout);
                    resolve();
                }
            };

            const timeout = window.setTimeout(() => {
                this.pc?.removeEventListener("icegatheringstatechange", onStateChange);
                this.log("ICE gathering timed out, proceeding with available candidates", "warn");
                resolve();
            }, WHEPPlayer.ICE_GATHER_TIMEOUT_MS);

            this.pc?.addEventListener("icegatheringstatechange", onStateChange);
        });
    }

    /** 固定間隔での再接続スケジュール */
    private scheduleReconnect(reason: string) {
        if (this.reconnectTimer || this.stopped) return;

        this.setStatus("retrying");
        this.log(`Reconnecting in ${WHEPPlayer.RETRY_DELAY_MS}ms — ${reason}`, "retry");
        this.destroyConnection();

        this.reconnectTimer = window.setTimeout(() => {
            this.reconnectTimer = null;
            this.start();
        }, WHEPPlayer.RETRY_DELAY_MS);
    }

    /** RTCPeerConnectionとメディアソースを破棄 */
    private destroyConnection() {
        if (this.pc) {
            this.pc.onconnectionstatechange = null;
            this.pc.oniceconnectionstatechange = null;
            this.pc.ontrack = null;
            this.pc.close();
            this.pc = null;
        }
        this.videoEl.srcObject = null;
        this.isConnecting = false;
    }

    private setStatus(status: ConnectionStatus) {
        this.onStatusChange?.(status);
    }

    stop() {
        this.stopped = true;
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        this.destroyConnection();
        this.setStatus("disconnected");
    }
}
