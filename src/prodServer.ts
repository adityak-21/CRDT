import express from "express";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import path from "path";

interface Room {
  operations: any[];
  rgaOperations: any[];
  clients: Map<WebSocket, string>;
}

const rooms = new Map<string, Room>();

function getRoom(roomId: string): Room {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, { operations: [], rgaOperations: [], clients: new Map() });
  }
  return rooms.get(roomId)!;
}

const app = express();
const server = http.createServer(app);

// Serve the built frontend
const distPath = path.join(process.cwd(), "dist");
app.use(express.static(distPath));

// All routes serve index.html (for client-side routing)
app.get("/{*splat}", (_req, res) => {
    res.sendFile(path.join(process.cwd(), "dist", "index.html"));
});

// WebSocket on the same server
const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  let currentRoom: Room | null = null;
  let currentRoomId: string | null = null;

  ws.on("message", (data) => {
    const message = JSON.parse(data.toString());

    if (message.type === "join") {
      currentRoomId = message.roomId;
      currentRoom = getRoom(currentRoomId!);
      currentRoom.clients.set(ws, message.nodeId);

      console.log(`"${message.nodeId}" joined "${currentRoomId}" (${currentRoom.clients.size} clients)`);

      ws.send(JSON.stringify({
        type: "sync",
        operations: currentRoom.operations,
        rgaOperations: currentRoom.rgaOperations,
      }));

      broadcastPresence(currentRoom);
    }

    if (message.type === "operation" && currentRoom) {
      currentRoom.operations.push(message.operation);
      broadcast(currentRoom, ws, { type: "operation", operation: message.operation });
    }

    if (message.type === "rga-operation" && currentRoom) {
      currentRoom.rgaOperations.push(message.operation);
      broadcast(currentRoom, ws, { type: "rga-operation", operation: message.operation });
    }

    if (message.type === "cursor" && currentRoom) {
      broadcast(currentRoom, ws, message);
    }
  });

  ws.on("close", () => {
    if (currentRoom) {
      const nodeId = currentRoom.clients.get(ws);
      currentRoom.clients.delete(ws);
      console.log(`"${nodeId}" left "${currentRoomId}" (${currentRoom.clients.size} clients)`);
      broadcast(currentRoom, ws, { type: "user-left", nodeId });
      if (currentRoom.clients.size === 0) rooms.delete(currentRoomId!);
    }
  });
});

function broadcast(room: Room, sender: WebSocket, message: any) {
  const data = JSON.stringify(message);
  for (const [client] of room.clients) {
    if (client !== sender && client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

function broadcastPresence(room: Room) {
  const users = Array.from(room.clients.values());
  const data = JSON.stringify({ type: "presence", users });
  for (const [client] of room.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(data);
  }
}

const PORT = parseInt(process.env.PORT || "3000");
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});