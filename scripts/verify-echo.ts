import { WebRtcHttpBridge } from "../packages/client/src/bridge";
import { WebRtcHttpServer, IDataChannel } from "../packages/server/src/index";
import { TunnelRequest, TunnelResponse } from "../packages/shared/src/protocol";

// Mock DataChannel
class MockDataChannel implements IDataChannel, RTCDataChannel {
    otherSide?: MockDataChannel;
    onmessage: ((event: { data: any }) => void) | null = null;
    readyState: RTCDataChannelState = "open";

    // RTCDataChannel properties (unused in this mock but required by type)
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
                // Dispatch event style if listener added via addEventListener
                const event = { type: 'message', data } as MessageEvent;
                this.otherSide.dispatchEvent(event);
            }
        }, 10);
    }

    // EventTarget methods
    private listeners: Record<string, Function[]> = {};
    addEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions): void {
        if (!listener) return;
        this.listeners[type] = this.listeners[type] || [];
        this.listeners[type].push(typeof listener === 'object' ? listener.handleEvent : listener);
    }
    removeEventListener(type: string, callback: EventListenerOrEventListenerObject | null, options?: boolean | EventListenerOptions): void { }
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
                    console.log("[Client] SW Controller received:", JSON.stringify(msg, null, 2));
                    if (msg.type === "TUNNEL_RESPONSE") {
                        console.log("SUCCESS: Received TUNNEL_RESPONSE");
                        if (msg.body === "PONG") {
                            console.log("SUCCESS: Body is PONG");
                            process.exit(0);
                        } else {
                            console.error("FAILURE: Body is not PONG, got", msg.body);
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

// Start Bridge and Server
console.log("Starting System...");
const bridge = new WebRtcHttpBridge(clientDC);
const server = new WebRtcHttpServer(serverDC);

// Trigger Request
const requestId = "test-req-1";
const request: TunnelRequest = {
    type: "TUNNEL_REQUEST",
    requestId,
    method: "GET",
    url: "https://example.com/p2p/echo",
    headers: {},
    body: null
};

console.log("Sending Request from Mock SW...");
mockServiceWorkerCallbacks.forEach(cb => cb({ data: request }));

// Timeout
setTimeout(() => {
    console.error("TIMEOUT: Did not receive response in time");
    process.exit(1);
}, 2000);
