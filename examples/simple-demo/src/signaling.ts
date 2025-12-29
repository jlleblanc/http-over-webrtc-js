import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 8080 });

console.log('Signaling server running on port 8080');

wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        // Broadcast to everyone else (simple mesh)
        const data = message.toString();
        console.log('Relaying:', data.slice(0, 50) + "...");
        wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === 1) {
                client.send(data);
            }
        });
    });
});
