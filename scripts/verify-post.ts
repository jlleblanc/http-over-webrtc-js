import { WebRtcHttpBridge } from "../packages/client/src/bridge";
import { WebRtcHttpServer, IDataChannel } from "../packages/server/src/index";
import { TunnelRequest, HttpReqStart } from "../packages/shared/src/protocol";

// Mock DataChannel...
class MockDataChannel implements IDataChannel, RTCDataChannel {
    otherSide?: MockDataChannel;
    onmessage: ((event: { data: any }) => void) | null = null;
    readyState: RTCDataChannelState = "open";
    binaryType: BinaryType = "arraybuffer";
    // ...
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

// Mock Navigator ServiceWorker
const mockServiceWorkerCallbacks: Function[] = [];
// @ts-ignore
Object.defineProperty(global, 'navigator', {
    value: {
        serviceWorker: {
            controller: {
                postMessage: (msg: any) => {
                    if (msg.type === "TUNNEL_RESPONSE") {
                        console.log("Received Response Body:", msg.body);
                        process.exit(0);
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

// Patch Server to handle POST echo for test
const originalHandleRequest = WebRtcHttpServer.prototype['handleRequest'];
// We can't easily patch private method. 
// Let's rely on Server receiving the log or modify Server to support POST if needed.
// Ah, currently Server ignores body and reads file.
// We need to UPDATE Server to handle POST properly or at least logs.

// We will test Client Side serialization -> DC transmission.
// We can listen on Server DC.

serverDC.onmessage = (event) => {
    try {
        const msg = JSON.parse(event.data) as HttpReqStart;
        if (msg.type === "HTTP_REQ_START") {
            console.log("Server Received:", msg.method, msg.path, "Body:", JSON.stringify(msg.body));
            if (msg.body && msg.body.foo === "bar") {
                console.log("SUCCESS: Body Match");
                process.exit(0);
            } else {
                console.error("FAILURE: Body Mismatch");
                process.exit(1);
            }
        }
    } catch (e) { }
};


// Start Bridge
const bridge = new WebRtcHttpBridge(clientDC);

console.log("Requesting POST /p2p/submit...");
const request: TunnelRequest = {
    type: "TUNNEL_REQUEST",
    requestId: "req-post",
    method: "POST",
    url: "https://example.com/p2p/submit",
    headers: { "Content-Type": "application/json" },
    body: { foo: "bar" } // Simulate SW already serialized it
};

mockServiceWorkerCallbacks.forEach(cb => cb({ data: request }));

setTimeout(() => {
    console.error("TIMEOUT");
    process.exit(1);
}, 2000);
