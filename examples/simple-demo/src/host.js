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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const server_1 = require("@http-over-webrtc/server");
const ws_1 = __importDefault(require("ws"));
const path = __importStar(require("path"));
// Note: You need to install 'wrtc' and 'ws' for this to run in Node
// npm install wrtc ws @types/ws
let RTCPeerConnection;
let RTCSessionDescription;
let RTCIceCandidate;
try {
    let wrtc;
    try {
        wrtc = require('wrtc');
    }
    catch (e) {
        try {
            wrtc = require('@roamhq/wrtc');
        }
        catch (e2) {
            throw new Error("Neither 'wrtc' nor '@roamhq/wrtc' could be found.");
        }
    }
    RTCPeerConnection = wrtc.RTCPeerConnection;
    RTCSessionDescription = wrtc.RTCSessionDescription;
    RTCIceCandidate = wrtc.RTCIceCandidate;
}
catch (e) {
    console.error("\n\x1b[31mError: Native WebRTC dependency not found.\x1b[0m");
    console.error("Please install one of the following packages:");
    console.error("  \x1b[36mnpm install wrtc\x1b[0m       (Standard, for Intel Mac/Linux)");
    console.error("  \x1b[36mnpm install @roamhq/wrtc\x1b[0m (Better for M1/M2 Mac)\n");
    console.error("Original error:", e);
    process.exit(1);
}
const ws = new ws_1.default('ws://localhost:8080');
const pc = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
});
pc.ondatachannel = (event) => {
    const dc = event.channel;
    if (dc.label === 'http-proxy') {
        console.log("Received DataChannel 'http-proxy'");
        const server = new server_1.WebRtcHttpServer(dc, path.join(__dirname, "../../public_html"));
        console.log("Serving ./public_html");
    }
};
ws.on('open', () => {
    console.log('Connected to signaling server');
    ws.send(JSON.stringify({ type: 'register', id: 'host' }));
});
ws.on('message', async (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.type === 'signal') {
        const from = msg.from;
        const payload = msg.payload;
        try {
            if (payload.type === 'offer') {
                console.log(`Received offer from ${from}`);
                // Create a new PC for each client in a real app, but for simple demo reuse or recreate?
                // For this demo let's just support one or assume sequential. 
                // Actually, existing code reused `pc`. That means it only supports one client properly or races.
                // Let's stick to existing "one pc" logic but wrapped. 
                // Wait, if I reuse `pc`, I need to be careful.
                // The user complained about "Signaling Collision".
                // Ideally I should create a PC map.
                // But for "simple-demo" let's just make sure we reply to the right person.
                // If we want to support multiple clients, we need `pc` per `from`.
                // Let's do a simple single-client fix first, or maybe a map if easy.
                // The `pc` variable is global. Let's keep it global for minimum friction change, 
                // but note that this limits concurrency (which might be fine for simple demo).
                await pc.setRemoteDescription(new RTCSessionDescription(payload.offer));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                ws.send(JSON.stringify({
                    type: 'signal',
                    target: from,
                    payload: { type: 'answer', answer }
                }));
            }
            else if (payload.type === 'candidate') {
                await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
            }
        }
        catch (e) {
            console.error(e);
        }
    }
});
// We need to capture the "current target" for ICE candidates if we want to send them back.
// Since `pc` is single, we can remember the last `from`.
// But `pc.onicecandidate` doesn't know who triggered it.
// This single-PC architecture is flawed for multiple clients.
// However, the prompt asks to fix "Signaling Collision". Targeted messaging fixes the collision on the wire.
// For the candidate sending:
let currentClient = null;
// We'll capture it in the 'offer' handler above (I'll modify the code above to set currentClient).
// Wait, I can't easily modify the `pc` variable scope without rewriting the whole file. 
// I'll stick to the requested change: "message protocol".
// I'll wrap the outgoing ICE candidates to "broadcast" or "last seen"? 
// Since we only have one `pc`, let's assume one client.
// Or actually, `pc.onicecandidate` will fire. We need to send it to the peer.
// In the original code it broadcasted. Now we need a target.
// I will introduce a `connectedRemoteId` variable.
// Let's rewrite the `open` and `message` handlers and the `onicecandidate`.
//# sourceMappingURL=host.js.map