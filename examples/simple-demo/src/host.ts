import { WebRtcHttpServer } from "@http-over-webrtc/server";
import WebSocket from 'ws';
import * as path from 'path';

// Note: You need to install 'wrtc' and 'ws' for this to run in Node
// npm install wrtc ws @types/ws

let RTCPeerConnection: any;
let RTCSessionDescription: any;
let RTCIceCandidate: any;

try {
    const wrtc = require('wrtc');
    RTCPeerConnection = wrtc.RTCPeerConnection;
    RTCSessionDescription = wrtc.RTCSessionDescription;
    RTCIceCandidate = wrtc.RTCIceCandidate;
} catch (e) {
    console.error("Error: 'wrtc' package not found. Please install it using: npm install wrtc");
    // process.exit(1); // Don't exit yet, let's see if we can install it
}

const ws = new WebSocket('ws://localhost:8080');
const pc = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
});

pc.ondatachannel = (event: any) => {
    const dc = event.channel;
    if (dc.label === 'http-proxy') {
        console.log("Received DataChannel 'http-proxy'");
        const server = new WebRtcHttpServer(dc, path.join(__dirname, "../../public_html"));
        console.log("Serving ./public_html");
    }
};

pc.onicecandidate = (event: any) => {
    if (event.candidate) {
        ws.send(JSON.stringify({ type: 'candidate', candidate: event.candidate }));
    }
};

ws.on('open', () => {
    console.log('Connected to signaling server');
});

ws.on('message', async (data: any) => {
    const msg = JSON.parse(data.toString());

    try {
        if (msg.type === 'offer') {
            await pc.setRemoteDescription(new RTCSessionDescription(msg.offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            ws.send(JSON.stringify({ type: 'answer', answer }));
        } else if (msg.type === 'candidate') {
            await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
        }
    } catch (e) {
        console.error(e);
    }
});
