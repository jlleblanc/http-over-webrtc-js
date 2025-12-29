"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebRtcHttpServer = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const CHUNK_SIZE = 16 * 1024; // 16KB safe limit
const MAX_BUFFERED_AMOUNT = 64 * 1024; // Wait if buffer > 64KB
class WebRtcHttpServer {
    constructor(dc, mountPath = "./") {
        this.dc = dc;
        this.mountPath = path.resolve(mountPath);
        this.setupDataChannel();
    }
    setupDataChannel() {
        this.dc.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === "HTTP_REQ_START") {
                    this.handleRequest(msg);
                }
            }
            catch (e) {
                console.error("[Server] Failed to parse message", e);
            }
        };
    }
    handleRequest(req) {
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
                }
                else {
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
            if (ext === ".html")
                mime = "text/html";
            if (ext === ".json")
                mime = "application/json";
            if (ext === ".css")
                mime = "text/css";
            if (ext === ".js")
                mime = "text/javascript";
            if (ext === ".png")
                mime = "image/png";
            if (ext === ".jpg" || ext === ".jpeg")
                mime = "image/jpeg";
            if (stats.size > CHUNK_SIZE) {
                this.sendChunkedFile(req.id, fullPath, mime);
            }
            else {
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
    sendChunkedFile(id, fullPath, mime) {
        // Send Metadata
        const meta = {
            type: "HTTP_RES_METADATA",
            id,
            status: 200,
            mime
        };
        this.dc.send(JSON.stringify(meta));
        const stream = fs.createReadStream(fullPath, { highWaterMark: CHUNK_SIZE });
        let seq = 0;
        // Implement flow control
        const sendLoop = () => {
            while (this.dc.bufferedAmount < MAX_BUFFERED_AMOUNT) {
                const chunk = stream.read();
                if (chunk === null) {
                    return; // Wait for 'readable' or 'end'
                }
                const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
                const chunkMsg = {
                    type: "HTTP_RES_CHUNK",
                    id,
                    seq: seq++,
                    data: buf.toString('base64')
                };
                this.dc.send(JSON.stringify(chunkMsg));
            }
            // Buffer full, pause stream intentionally? 
            // Actually, stream.read() consumes data. If we stop reading, stream pauses automatically?
            // No, stream buffers too.
            // Better approach: pipe logic manually?
            // Or pause stream when buffer is full.
            // But stream.read() is synchronous.
        };
        // Actually, stream.on('data') is flowing mode.
        // Let's use paused mode with readable event for better control or just pause/resume.
        stream.pause(); // Start paused
        stream.on('readable', () => {
            pump();
        });
        stream.on('end', () => {
            const endMsg = {
                type: "HTTP_RES_END",
                id
            };
            this.dc.send(JSON.stringify(endMsg));
        });
        stream.on('error', (err) => {
            console.error("[Server] Stream Error", err);
        });
        this.dc.onbufferedamountlow = () => {
            pump();
        };
        const pump = () => {
            let chunk;
            while (this.dc.bufferedAmount < MAX_BUFFERED_AMOUNT && (chunk = stream.read()) !== null) {
                const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
                const chunkMsg = {
                    type: "HTTP_RES_CHUNK",
                    id,
                    seq: seq++,
                    data: buf.toString('base64')
                };
                this.dc.send(JSON.stringify(chunkMsg));
            }
        };
    }
    sendResponse(id, status, mime, data) {
        const res = {
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
exports.WebRtcHttpServer = WebRtcHttpServer;
//# sourceMappingURL=index.js.map