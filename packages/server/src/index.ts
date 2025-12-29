import * as fs from 'fs';
import * as path from 'path';
import { HttpReqStart, HttpRes, HttpResChunk, HttpResEnd, HttpResMetadata } from "@http-over-webrtc/shared";

// Abstract interface for the Data Channel to allow mocking or wrapping 'wrtc' package
export interface IDataChannel {
    send(data: string | ArrayBuffer): void;
    onmessage: ((event: { data: any }) => void) | null;
}

const CHUNK_SIZE = 16 * 1024; // 16KB safe limit

export class WebRtcHttpServer {
    private dc: IDataChannel;
    private mountPath: string;

    constructor(dc: IDataChannel, mountPath: string = "./") {
        this.dc = dc;
        this.mountPath = path.resolve(mountPath);
        this.setupDataChannel();
    }

    private setupDataChannel() {
        this.dc.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data) as HttpReqStart;
                if (msg.type === "HTTP_REQ_START") {
                    this.handleRequest(msg);
                }
            } catch (e) {
                console.error("[Server] Failed to parse message", e);
            }
        };
    }

    private handleRequest(req: HttpReqStart) {
        console.log("[Server] Handling", req.path);

        if (req.path === "/p2p/echo") {
            this.sendResponse(req.id, 200, "text/plain", "PONG");
            return;
        }

        const relativePath = req.path.replace(/^\/p2p\//, "");
        const fullPath = path.resolve(this.mountPath, relativePath);

        if (!fullPath.startsWith(this.mountPath)) {
            console.warn("[Server] Access Denied:", fullPath);
            this.sendResponse(req.id, 403, "text/plain", "Access Denied");
            return;
        }

        fs.stat(fullPath, (err, stats) => {
            if (err) {
                if (err.code === "ENOENT") {
                    this.sendResponse(req.id, 404, "text/plain", "Not Found");
                } else {
                    this.sendResponse(req.id, 500, "text/plain", "Internal Server Error");
                }
                return;
            }

            if (stats.isDirectory()) {
                this.sendResponse(req.id, 403, "text/plain", "Directory Listing Forbidden");
                return;
            }

            const ext = path.extname(fullPath).toLowerCase();
            let mime = "application/octet-stream";
            if (ext === ".html") mime = "text/html";
            if (ext === ".json") mime = "application/json";
            if (ext === ".css") mime = "text/css";
            if (ext === ".js") mime = "text/javascript";
            if (ext === ".png") mime = "image/png";
            if (ext === ".jpg" || ext === ".jpeg") mime = "image/jpeg";

            if (stats.size > CHUNK_SIZE) {
                this.sendChunkedFile(req.id, fullPath, mime);
            } else {
                // Small file, send normally
                fs.readFile(fullPath, (err, data) => {
                    if (err) {
                        this.sendResponse(req.id, 500, "text/plain", "Read Error");
                        return;
                    }
                    const isBinary = !mime.startsWith("text/") && mime !== "application/json";
                    const payload = isBinary ? data.toString('base64') : data.toString('utf8');

                    this.sendResponse(req.id, 200, mime, payload);
                });
            }
        });
    }

    private sendChunkedFile(id: string, fullPath: string, mime: string) {
        // Send Metadata
        const meta: HttpResMetadata = {
            type: "HTTP_RES_METADATA",
            id,
            status: 200,
            mime
        };
        this.dc.send(JSON.stringify(meta));

        const stream = fs.createReadStream(fullPath, { highWaterMark: CHUNK_SIZE });
        let seq = 0;

        stream.on('data', (chunk: Buffer | string) => {
            const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            const chunkMsg: HttpResChunk = {
                type: "HTTP_RES_CHUNK",
                id,
                seq: seq++,
                data: buf.toString('base64')
            };
            this.dc.send(JSON.stringify(chunkMsg));
        });

        stream.on('end', () => {
            const endMsg: HttpResEnd = {
                type: "HTTP_RES_END",
                id
            };
            this.dc.send(JSON.stringify(endMsg));
        });

        stream.on('error', (err) => {
            console.error("[Server] Stream Error", err);
        });
    }

    private sendResponse(id: string, status: number, mime: string, data: string) {
        const res: HttpRes = {
            type: "HTTP_RES",
            id: id,
            status: status,
            mime: mime,
            data: data,
            complete: true
        };
        this.dc.send(JSON.stringify(res));
    }
}
