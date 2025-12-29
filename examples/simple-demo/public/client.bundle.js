"use strict";
(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));

  // packages/client/dist/bridge.js
  var require_bridge = __commonJS({
    "packages/client/dist/bridge.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.WebRtcHttpBridge = void 0;
      var WebRtcHttpBridge2 = class {
        constructor(dc2) {
          this.transfers = /* @__PURE__ */ new Map();
          this.dc = dc2;
          this.setupDataChannel();
          this.setupServiceWorker();
        }
        setupDataChannel() {
          this.dc.addEventListener("message", (event) => {
            try {
              const msg = JSON.parse(event.data);
              this.handleMessage(msg);
            } catch (e) {
              console.error("[Bridge] Failed to parse DC message", e);
            }
          });
        }
        handleMessage(msg) {
          if (msg.type === "HTTP_RES") {
            const isBinary = !msg.mime.startsWith("text/") && msg.mime !== "application/json";
            let body = msg.data;
            if (isBinary && typeof msg.data === "string") {
              body = this.base64ToArrayBuffer(msg.data);
            }
            this.sendToSw({
              type: "TUNNEL_RESPONSE",
              requestId: msg.id,
              status: msg.status,
              statusText: "OK",
              headers: { "Content-Type": msg.mime },
              body,
              isBinary
            });
          } else if (msg.type === "HTTP_RES_METADATA") {
            this.transfers.set(msg.id, {
              chunks: [],
              mime: msg.mime,
              totalSize: 0
            });
          } else if (msg.type === "HTTP_RES_CHUNK") {
            const transfer = this.transfers.get(msg.id);
            if (transfer) {
              const chunkBuffer = this.base64ToArrayBuffer(msg.data);
              transfer.chunks.push(new Uint8Array(chunkBuffer));
              transfer.totalSize += chunkBuffer.byteLength;
            } else {
              console.warn("[Bridge] Received chunk for unknown transfer", msg.id);
            }
          } else if (msg.type === "HTTP_RES_END") {
            const transfer = this.transfers.get(msg.id);
            if (transfer) {
              this.transfers.delete(msg.id);
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
        base64ToArrayBuffer(base64) {
          const binaryString = atob(base64);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          return bytes.buffer;
        }
        setupServiceWorker() {
          if (!navigator.serviceWorker)
            return;
          navigator.serviceWorker.addEventListener("message", (event) => {
            const msg = event.data;
            if (msg && msg.type === "TUNNEL_REQUEST") {
              const hostReq = {
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
        sendToSw(msg) {
          if (navigator.serviceWorker.controller) {
            const transferList = msg.isBinary && msg.body instanceof ArrayBuffer ? [msg.body] : [];
            navigator.serviceWorker.controller.postMessage(msg, transferList);
          }
        }
      };
      exports.WebRtcHttpBridge = WebRtcHttpBridge2;
    }
  });

  // packages/client/dist/index.js
  var require_dist = __commonJS({
    "packages/client/dist/index.js"(exports) {
      "use strict";
      var __createBinding = exports && exports.__createBinding || (Object.create ? (function(o, m, k, k2) {
        if (k2 === void 0) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
          desc = { enumerable: true, get: function() {
            return m[k];
          } };
        }
        Object.defineProperty(o, k2, desc);
      }) : (function(o, m, k, k2) {
        if (k2 === void 0) k2 = k;
        o[k2] = m[k];
      }));
      var __exportStar = exports && exports.__exportStar || function(m, exports2) {
        for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports2, p)) __createBinding(exports2, m, p);
      };
      Object.defineProperty(exports, "__esModule", { value: true });
      __exportStar(require_bridge(), exports);
    }
  });

  // examples/simple-demo/src/client.ts
  var import_client = __toESM(require_dist());
  var statusEl = document.getElementById("status");
  var ws = new WebSocket("ws://localhost:8080");
  var pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  });
  var dc = pc.createDataChannel("http-proxy");
  var bridge = new import_client.WebRtcHttpBridge(dc);
  dc.onopen = () => {
    console.log("DataChannel Open!");
    statusEl.innerHTML = "Connected! Loading /p2p/index.html...";
    navigator.serviceWorker.register("./sw.js").then(() => {
      console.log("SW Registered");
      setTimeout(() => {
        const iframe = document.getElementById("content");
        iframe.src = "/p2p/index.html";
      }, 1e3);
    }).catch((err) => console.error(err));
  };
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      ws.send(JSON.stringify({ type: "candidate", candidate: event.candidate }));
    }
  };
  ws.onopen = async () => {
    console.log("Connected to signaling server");
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    ws.send(JSON.stringify({ type: "offer", offer }));
  };
  ws.onmessage = async (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === "answer") {
      await pc.setRemoteDescription(msg.answer);
    } else if (msg.type === "candidate") {
      await pc.addIceCandidate(msg.candidate);
    }
  };
})();
//# sourceMappingURL=client.bundle.js.map
