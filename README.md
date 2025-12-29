# HTTP-over-WebRTC Proxy

A peer-to-peer HTTP proxy library that enables a web browser to transparently fetch resources from a remote peer via WebRTC DataChannels.

This library intercepts standard browser `fetch` requests (via Service Workers) and tunnels them to a remote "Host" (Node.js/Electron), effectively creating a decentralized, serverless web server.

## Features

- **Transparent Interception**: Use standard `fetch('/p2p/your-file.html')` in your web app.
- **Binary Support**: Automatic chunking for large files (images, video) using a custom 16KB-limited protocol.
- **Security**: Strict path sanitization on the Host to prevent directory traversal attacks.
- **POST Support**: Handles request bodies for form submissions and JSON APIs.
- **Mime Detection**: Automatically serves correct content types from the host file system.

## Project Structure

This is a TypeScript monorepo managed with npm workspaces:

- `packages/client`: Browser-side logic (Service Worker & Bridge).
- `packages/server`: Node.js/Electron Host logic.
- `packages/shared`: Shared protocol types and message definitions.
- `examples/simple-demo`: A pre-configured demo with a WebSocket signaling server.

## Getting Started

### 1. Installation

Install dependencies from the root:

```bash
npm install
```

### 2. Basic Usage

#### Client Setup (Main Thread)
Initialize the bridge with a `RTCDataChannel`:

```typescript
import { WebRtcHttpBridge } from "@http-over-webrtc/client";

// Assuming 'pc' is your RTCPeerConnection instance
const dc = pc.createDataChannel("http-proxy");
const bridge = new WebRtcHttpBridge(dc);

// Register the Service Worker (included in @http-over-webrtc/client)
navigator.serviceWorker.register('./sw.js');
```

#### Host Setup (Node.js)
Mount a directory to be served over the tunnel:

```typescript
import { WebRtcHttpServer } from "@http-over-webrtc/server";

// Assuming 'dc' is the RTCDataChannel received from the peer
const server = new WebRtcHttpServer(dc, "./public_html");
```

### 3. Running the Demo

The demo includes a signaling server, a host, and a client page.

1. **Build the project**:
   ```bash
   npm run build
   node scripts/build-demo.js
   ```

2. **Start the Signaling Server**:
   ```bash
   npx ts-node examples/simple-demo/src/signaling.ts
   ```

3. **Start the Host (Node)**: 
   *(Requires `wrtc` installed: `npm install wrtc`)*
   ```bash
   npx ts-node examples/simple-demo/src/host.ts
   ```

4. **Serve the Client**:
   ```bash
   npx http-server examples/simple-demo/public -p 3000
   ```

5. **Visit**: `http://localhost:3000`

## Protocol Technical Details

The library uses a multi-layered messaging system:

1. **Layer 1 (SW <-> Bridge)**: `TUNNEL_REQUEST` and `TUNNEL_RESPONSE` via `postMessage`.
2. **Layer 2 (Bridge <-> Host)**: WebRTC DataChannel messages:
   - `HTTP_REQ_START`: Initiates a request.
   - `HTTP_RES`: Single-packet response for small files.
   - `HTTP_RES_METADATA` / `CHUNK` / `END`: Streamed response for large binary files.

## License
MIT
