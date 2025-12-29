export interface IDataChannel {
    send(data: string | ArrayBuffer): void;
    onmessage: ((event: {
        data: any;
    }) => void) | null;
    bufferedAmount: number;
    bufferedAmountLowThreshold: number;
    onbufferedamountlow: (() => void) | null;
}
export declare class WebRtcHttpServer {
    private dc;
    private mountPath;
    constructor(dc: IDataChannel, mountPath?: string);
    private setupDataChannel;
    private handleRequest;
    private sendChunkedFile;
    private sendResponse;
}
//# sourceMappingURL=index.d.ts.map