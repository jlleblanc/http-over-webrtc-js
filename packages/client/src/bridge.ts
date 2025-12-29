import { TunnelRequest, TunnelResponse, HttpReqStart, HttpRes, TunnelMessage, HttpResChunk } from "@http-over-webrtc/shared";

interface PendingTransfer {
    chunks: Uint8Array[];
    mime: string;
    totalSize: number;
}

export class WebRtcHttpBridge {
    private dc: RTCDataChannel;
    private transfers: Map<string, PendingTransfer> = new Map();

    constructor(dc: RTCDataChannel) {
        this.dc = dc;
        this.setupDataChannel();
        this.setupServiceWorker();
    }

    private setupDataChannel() {
        this.dc.addEventListener("message", (event) => {
            try {
                const msg = JSON.parse(event.data) as TunnelMessage;
                this.handleMessage(msg);
            } catch (e) {
                console.error("[Bridge] Failed to parse DC message", e);
            }
        });
    }

    private handleMessage(msg: TunnelMessage) {
        // console.log("[Bridge] Rx Msg:", msg.type, msg.id);
        if (msg.type === "HTTP_RES") {
            const isBinary = !msg.mime.startsWith("text/") && msg.mime !== "application/json";

            let body = msg.data;
            if (isBinary && typeof msg.data === 'string') {
                body = this.base64ToArrayBuffer(msg.data);
            }

            this.sendToSw({
                type: "TUNNEL_RESPONSE",
                requestId: msg.id,
                status: msg.status,
                statusText: "OK",
                headers: { "Content-Type": msg.mime },
                body: body,
                isBinary: isBinary
            });
        }
        else if (msg.type === "HTTP_RES_METADATA") {
            this.transfers.set(msg.id, {
                chunks: [],
                mime: msg.mime,
                totalSize: 0
            });
        }
        else if (msg.type === "HTTP_RES_CHUNK") {
            const transfer = this.transfers.get(msg.id);
            if (transfer) {
                const chunkBuffer = this.base64ToArrayBuffer(msg.data); // Decode immediately
                // Convert ArrayBuffer to Uint8Array for storage
                transfer.chunks.push(new Uint8Array(chunkBuffer));
                transfer.totalSize += chunkBuffer.byteLength;
            } else {
                console.warn("[Bridge] Received chunk for unknown transfer", msg.id);
            }
        }
        else if (msg.type === "HTTP_RES_END") {
            const transfer = this.transfers.get(msg.id);
            if (transfer) {
                this.transfers.delete(msg.id);
                // Reassemble binary
                const combinedBuffer = new Uint8Array(transfer.totalSize);
                let offset = 0;
                for (const chunk of transfer.chunks) {
                    combinedBuffer.set(chunk, offset);
                    offset += chunk.length;
                }

                this.sendToSw({
                    type: "TUNNEL_RESPONSE",
                    requestId: msg.id,
                    status: 200,
                    statusText: "OK",
                    headers: { "Content-Type": transfer.mime },
                    body: combinedBuffer.buffer,
                    isBinary: true
                });
            }
        }
    }

    private base64ToArrayBuffer(base64: string): ArrayBuffer {
        const binaryString = atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    }

    private setupServiceWorker() {
        if (!navigator.serviceWorker) return;

        navigator.serviceWorker.addEventListener("message", (event) => {
            const msg = event.data as TunnelRequest;
            if (msg && msg.type === "TUNNEL_REQUEST") {
                // console.log("[Bridge] Received request from SW", msg.url);

                const hostReq: HttpReqStart = {
                    type: "HTTP_REQ_START",
                    id: msg.requestId,
                    method: msg.method,
                    path: new URL(msg.url).pathname,
                    body: msg.body
                };

                if (this.dc.readyState === "open") {
                    this.dc.send(JSON.stringify(hostReq));
                } else {
                    console.warn("[Bridge] DC not open");
                    this.sendToSw({
                        type: "TUNNEL_RESPONSE",
                        requestId: msg.requestId,
                        status: 503,
                        statusText: "Service Unavailable",
                        headers: {},
                        body: "WebRTC DataChannel not connected",
                        isBinary: false
                    });
                }
            }
        });
    }

    private sendToSw(msg: TunnelResponse) {
        if (navigator.serviceWorker.controller) {
            const transferList = (msg.isBinary && msg.body instanceof ArrayBuffer) ? [msg.body] : [];
            navigator.serviceWorker.controller.postMessage(msg, transferList);
        }
    }
}
