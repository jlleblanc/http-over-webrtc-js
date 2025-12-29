import { WebRtcHttpBridge } from "../packages/client/src/bridge";
import { WebRtcHttpServer, IDataChannel } from "../packages/server/src/index";
import { TunnelRequest } from "../packages/shared/src/protocol";
import * as fs from 'fs';
import * as path from 'path';

// Mock DataChannel (Same as previous)
class MockDataChannel implements IDataChannel, RTCDataChannel {
    otherSide?: MockDataChannel;
    onmessage: ((event: { data: any }) => void) | null = null;
    readyState: RTCDataChannelState = "open";
    binaryType: BinaryType = "blob";
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
        }, 10);
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

// Setup Test Content
const testDir = path.resolve(__dirname, "./tmp_test_content");
if (!fs.existsSync(testDir)) fs.mkdirSync(testDir);
fs.writeFileSync(path.join(testDir, "test.html"), "<h1>Hello World</h1>");

// Mock Navigator ServiceWorker
const mockServiceWorkerCallbacks: Function[] = [];
// @ts-ignore
Object.defineProperty(global, 'navigator', {
    value: {
        serviceWorker: {
            controller: {
                postMessage: (msg: any) => {
                    if (msg.type === "TUNNEL_RESPONSE") {
                        console.log("Received Response:", msg.status, msg.body);
                        if (msg.body === "<h1>Hello World</h1>" && msg.status === 200) {
                            console.log("SUCCESS");
                            // Clean up
                            fs.rmSync(testDir, { recursive: true, force: true });
                            process.exit(0);
                        } else {
                            console.error("FAILURE: Content mismatch");
                            fs.rmSync(testDir, { recursive: true, force: true });
                            process.exit(1);
                        }
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

// Start System
const bridge = new WebRtcHttpBridge(clientDC);
const server = new WebRtcHttpServer(serverDC, testDir);

console.log("Requesting /p2p/test.html...");
const request: TunnelRequest = {
    type: "TUNNEL_REQUEST",
    requestId: "req-text",
    method: "GET",
    url: "https://example.com/p2p/test.html",
    headers: {},
    body: null
};

// Dispatch
mockServiceWorkerCallbacks.forEach(cb => cb({ data: request }));

setTimeout(() => {
    console.error("TIMEOUT");
    fs.rmSync(testDir, { recursive: true, force: true });
    process.exit(1);
}, 2000);
