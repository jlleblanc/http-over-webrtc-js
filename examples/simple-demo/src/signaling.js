"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ws_1 = require("ws");
const wss = new ws_1.WebSocketServer({ port: 8080 });
console.log('Signaling server running on port 8080');
const clients = new Map();
wss.on('connection', (ws) => {
    let myId = "";
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message.toString());
            if (data.type === 'register') {
                myId = data.id;
                clients.set(myId, ws);
                console.log(`Client registered: ${myId}`);
            }
            else if (data.type === 'signal') {
                const targetWs = clients.get(data.target);
                if (targetWs && targetWs.readyState === 1) {
                    // console.log(`Relaying signal from ${myId} to ${data.target}`);
                    targetWs.send(JSON.stringify({
                        type: 'signal',
                        from: myId,
                        payload: data.payload
                    }));
                }
                else {
                    console.warn(`Target ${data.target} not found`);
                }
            }
        }
        catch (e) {
            console.error("Invalid message", e);
        }
    });
    ws.on('close', () => {
        if (myId) {
            clients.delete(myId);
            console.log(`Client disconnected: ${myId}`);
        }
    });
});
//# sourceMappingURL=signaling.js.map