import { WebRtcHttpBridge } from "@http-over-webrtc/client";

const statusEl = document.getElementById('status')!;
const ws = new WebSocket('ws://localhost:8080');
const pc = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
});

// Create Data Channel
const dc = pc.createDataChannel("http-proxy");
const bridge = new WebRtcHttpBridge(dc);

dc.onopen = () => {
    console.log("DataChannel Open!");
    statusEl.innerHTML = "Connected! Loading /p2p/index.html...";

    // Register Service Worker
    navigator.serviceWorker.register('./sw.js')
        .then(() => {
            console.log("SW Registered");
            // Give SW a moment to activate and claim
            setTimeout(() => {
                const iframe = document.getElementById('content') as HTMLIFrameElement;
                iframe.src = "/p2p/index.html";
            }, 1000);
        })
        .catch(err => console.error(err));
};

pc.onicecandidate = (event) => {
    if (event.candidate) {
        ws.send(JSON.stringify({ type: 'candidate', candidate: event.candidate }));
    }
};

ws.onopen = async () => {
    console.log('Connected to signaling server');
    // Create Offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    ws.send(JSON.stringify({ type: 'offer', offer }));
};

ws.onmessage = async (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === 'answer') {
        await pc.setRemoteDescription(msg.answer);
    } else if (msg.type === 'candidate') {
        await pc.addIceCandidate(msg.candidate);
    }
};
