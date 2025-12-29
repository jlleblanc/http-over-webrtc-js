"use strict";
(() => {
  // examples/simple-demo/src/host-browser.ts
  var ws = new WebSocket("ws://localhost:8080");
  var pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  });
  pc.ondatachannel = (event) => {
    const dc = event.channel;
    if (dc.label === "http-proxy") {
      console.log("Host: DataChannel 'http-proxy' opened");
      dc.onmessage = (e) => {
        const req = JSON.parse(e.data);
        console.log("Host: Received request", req.path);
        if (req.path === "/p2p/index.html") {
          const res = {
            type: "HTTP_RES",
            id: req.id,
            status: 200,
            mime: "text/html",
            data: "<h1>Hello from Browser Host!</h1><p>This page was loaded over WebRTC.</p><p><img src='/p2p/logo.png' alt='1x1 red dot'></p>",
            complete: true
          };
          dc.send(JSON.stringify(res));
        } else if (req.path === "/p2p/logo.png") {
          const res = {
            type: "HTTP_RES",
            id: req.id,
            status: 200,
            mime: "image/png",
            data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
            complete: true
          };
          dc.send(JSON.stringify(res));
        }
      };
    }
  };
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      ws.send(JSON.stringify({ type: "candidate", candidate: event.candidate, from: "host" }));
    }
  };
  ws.onopen = () => {
    console.log("Host: Connected to signaling server");
  };
  ws.onmessage = async (event) => {
    const msg = JSON.parse(event.data);
    if (msg.from === "host") return;
    if (msg.type === "offer") {
      await pc.setRemoteDescription(new RTCSessionDescription(msg.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      ws.send(JSON.stringify({ type: "answer", answer, from: "host" }));
    } else if (msg.type === "candidate") {
      await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
    }
  };
  document.body.innerHTML = "<h1>WebRTC Host (Browser)</h1><p>Waiting for client...</p>";
})();
//# sourceMappingURL=host.bundle.js.map
