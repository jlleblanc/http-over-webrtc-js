export interface TunnelRequest {
    type: "TUNNEL_REQUEST";
    requestId: string;
    method: string;
    url: string;
    headers: Record<string, string>;
    body: any;
}

export interface TunnelResponse {
    type: "TUNNEL_RESPONSE";
    requestId: string;
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: any;
    isBinary: boolean;
}

export interface HttpReqStart {
    type: "HTTP_REQ_START";
    id: string;
    method: string;
    path: string;
    body?: any; // JSON object or string (base64 if binary)
}

export interface HttpRes {
    type: "HTTP_RES";
    id: string;
    status: number;
    mime: string;
    data: any;
    complete: boolean;
}

export interface HttpResChunk {
    type: "HTTP_RES_CHUNK";
    id: string;
    seq: number;
    data: string; // Base64 encoded or string
}

export interface HttpResEnd {
    type: "HTTP_RES_END";
    id: string;
}

export interface HttpResMetadata { // Initial packet for chunked transfer
    type: "HTTP_RES_METADATA";
    id: string;
    status: number;
    mime: string;
}

// Discriminators
export type BridgeMessage = TunnelRequest | TunnelResponse;
export type TunnelMessage = HttpReqStart | HttpRes | HttpResChunk | HttpResEnd | HttpResMetadata;
