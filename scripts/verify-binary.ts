import { WebRtcHttpBridge } from "../packages/client/src/bridge";
import { WebRtcHttpServer, IDataChannel } from "../packages/server/src/index";
import { TunnelRequest } from "../packages/shared/src/protocol";
import * as fs from 'fs';
import * as path from 'path';

// Mock DataChannel
class MockDataChannel implements IDataChannel, RTCDataChannel {
    otherSide?: MockDataChannel;
    onmessage: ((event: { data: any }) => void) | null = null;
    readyState: RTCDataChannelState = "open";
    binaryType: BinaryType = "arraybuffer"; // Default
    // ... (rest of props)
    bufferedAmount: number = 0;
    bufferedAmountLowThreshold: number = 0;
    id: number | null = 0;
    label: string = "mock";
    maxPacketLifeTime: number | null = null;
    maxRetransmits: number | null = null;
    negotiated: boolean = false;
    onbufferedamountlow: ((this: RTCDataChannel, ev: Event) => any) | null = null;
    onclose: ((this: RTCDataChannel, ev: Event) => any) | null = null;
    onclosing: ((this: RTCDataChannel, ev: Event) => any) | null = null;
    onerror: ((this: RTCDataChannel, ev: Event) => any) | null = null;
    onopen: ((this: RTCDataChannel, ev: Event) => any) | null = null;
    ordered: boolean = true;
    protocol: string = "";

    send(data: string | ArrayBuffer | Blob | ArrayBufferView): void {
        setTimeout(() => {
            if (this.otherSide?.onmessage) {
                this.otherSide.onmessage({ data });
            } else if (this.otherSide) {
                const event = { type: 'message', data } as MessageEvent;
                this.otherSide.dispatchEvent(event);
            }
        }, 5);
    }
    // EventTarget methods
    private listeners: Record<string, Function[]> = {};
    addEventListener(type: string, listener: any, options?: any): void {
        if (!listener) return;
        this.listeners[type] = this.listeners[type] || [];
        this.listeners[type].push(typeof listener === 'object' ? listener.handleEvent : listener);
    }
    removeEventListener(type: string, callback: any, options?: any): void { }
    dispatchEvent(event: Event): boolean {
        if (this.listeners[event.type]) {
            this.listeners[event.type].forEach(l => l(event));
        }
        if (event.type === 'message' && this.onmessage) {
            this.onmessage(event as any);
        }
        return true;
    }
    close(): void { }
}

const clientDC = new MockDataChannel();
const serverDC = new MockDataChannel();
clientDC.otherSide = serverDC;
serverDC.otherSide = clientDC;

// Setup Large Test Content (>16KB)
const testDir = path.resolve(__dirname, "./tmp_test_content_bin");
if (!fs.existsSync(testDir)) fs.mkdirSync(testDir);
// create 50KB random file
const buffer = crypto.getRandomValues(new Uint8Array(50 * 1024));
fs.writeFileSync(path.join(testDir, "test.bin"), buffer);

// Mock Navigator ServiceWorker
const mockServiceWorkerCallbacks: Function[] = [];
// @ts- ignore
Object.defineProperty(global, 'navigator', {
    value: {
        serviceWorker: {
            controller: {
                postMessage: (msg: any) => {
                    if (msg.type === "TUNNEL_RESPONSE") {
                        console.log("Received Response Status:", msg.status);

                        if (msg.status === 200) {
                            if (msg.isBinary && msg.body instanceof ArrayBuffer) {
                                const receivedBuf = new Uint8Array(msg.body);
                                console.log(`Received Binary: ${receivedBuf.length} bytes`);
                                if (receivedBuf.length === buffer.length) {
                                    // Compare content
                                    let match = true;
                                    for (let i = 0; i < buffer.length; i++) {
                                        if (buffer[i] !== receivedBuf[i]) {
                                            match = false;
                                            break;
                                        }
                                    }
                                    if (match) {
                                        console.log("SUCCESS: Content matches");
                                        fs.rmSync(testDir, { recursive: true, force: true });
                                        process.exit(0);
                                    } else {
                                        console.error("FAILURE: Content Mismatch");
                                    }
                                } else {
                                    console.error(`FAILURE: Size Mismatch. Expected ${buffer.length}, got ${receivedBuf.length}`);
                                }
                            } else {
                                console.error("FAILURE: Expected Binary ArrayBuffer");
                            }
                        } else {
                            console.error("FAILURE: Non-200 Status", msg.body);
                        }
                        fs.rmSync(testDir, { recursive: true, force: true });
                        process.exit(1);
                    }
                }
            },
            addEventListener: (type: string, cb: any) => {
                if (type === 'message') mockServiceWorkerCallbacks.push(cb);
            }
        }
    },
    writable: true
});

// Polyfill atob for Node environment (used in Bridge)
(global as any).atob = (str: string) => Buffer.from(str, 'base64').toString('binary');


// Start System
const bridge = new WebRtcHttpBridge(clientDC);
const server = new WebRtcHttpServer(serverDC, testDir);

console.log("Requesting /p2p/test.bin...");
const request: TunnelRequest = {
    type: "TUNNEL_REQUEST",
    requestId: "req-bin",
    method: "GET",
    url: "https://example.com/p2p/test.bin",
    headers: {},
    body: null
};

mockServiceWorkerCallbacks.forEach(cb => cb({ data: request }));

setTimeout(() => {
    console.error("TIMEOUT");
    fs.rmSync(testDir, { recursive: true, force: true });
    process.exit(1);
}, 5000);
