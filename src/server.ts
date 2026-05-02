import { WebSocketServer, WebSocket } from "ws";
import { Operation } from "./crdt";

const PORT = 8080;

const clients: Set<WebSocket> = new Set();

const operationLog: Operation[] = [];

const wss = new WebSocketServer({ port: PORT });

wss.on("connection", (ws: WebSocket) => {
  console.log("Client connected. Total:", clients.size + 1);

  clients.add(ws);

  ws.send(JSON.stringify({
    type: "sync",
    operations: operationLog,
  }));

  ws.on("message", (data: Buffer) => {
    const message = JSON.parse(data.toString());

    if (message.type === "operation") {
      const op: Operation = message.operation;

      operationLog.push(op);

      for (const client of clients) {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: "operation",
            operation: op,
          }));
        }
      }

      console.log(`Operation: ${op.nodeId} set "${op.field}" = "${op.value}"`);
    }
  });

  ws.on("close", () => {
    clients.delete(ws);
    console.log("Client disconnected. Total:", clients.size);
  });
});

console.log(`Sync server running on ws://localhost:${PORT}`);