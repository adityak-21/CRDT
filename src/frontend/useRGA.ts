import { useState, useEffect, useRef, useCallback } from "react";
import { RGA, RGAOperation } from "../crdt/rga";

function generateNodeId(): string {
  return "user-" + Math.random().toString(36).slice(2, 6);
}

const USER_COLORS = [
  "#3b82f6", "#ef4444", "#10b981", "#f59e0b",
  "#8b5cf6", "#ec4899", "#06b6d4", "#f97316",
];

function getRandomColor(): string {
  return USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)];
}

export interface CursorInfo {
  nodeId: string;
  position: number;
  color: string;
}

export function useRGA(roomId: string) {
  const nodeId = useRef(generateNodeId()).current;
  const userColor = useRef(getRandomColor()).current;
  const rgaRef = useRef(new RGA(nodeId));
  const [text, setText] = useState("");
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const offlineQueue = useRef<RGAOperation[]>([]);
  const reconnectAttempt = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [cursors, setCursors] = useState<Map<string, CursorInfo>>(new Map());
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [stats, setStats] = useState({ chars: 0, tombstones: 0, ops: 0 });
  const opsCount = useRef(0);

  const syncState = useCallback(() => {
    const rga = rgaRef.current;
    const allNodes = rga.getAllNodes();
    setText(rga.toString());
    setStats({
      chars: rga.length,
      tombstones: allNodes.filter((n) => n.deleted).length,
      ops: opsCount.current,
    });
  }, []);

  const flushQueue = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    for (const op of offlineQueue.current) {
      ws.send(JSON.stringify({ type: "rga-operation", operation: op }));
    }
    offlineQueue.current = [];
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl =
      window.location.hostname === "localhost"
        ? "ws://localhost:8080"
        : `${protocol}//${window.location.host}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      reconnectAttempt.current = 0;
      ws.send(JSON.stringify({ type: "join", roomId, nodeId }));
      flushQueue();
    };

    ws.onmessage = (event: MessageEvent) => {
      const message = JSON.parse(event.data);

      if (message.type === "rga-sync") {
        for (const op of message.operations as RGAOperation[]) {
          rgaRef.current.apply(op);
          opsCount.current++;
        }
        syncState();
      }

      if (message.type === "rga-operation") {
        const op = message.operation as RGAOperation;
        rgaRef.current.apply(op);
        opsCount.current++;
        syncState();
      }

      if (message.type === "cursor") {
        setCursors((prev) => {
          const next = new Map(prev);
          next.set(message.nodeId, {
            nodeId: message.nodeId,
            position: message.position,
            color: message.color,
          });
          return next;
        });
      }

      if (message.type === "user-left") {
        setCursors((prev) => {
          const next = new Map(prev);
          next.delete(message.nodeId);
          return next;
        });
      }

      if (message.type === "presence") {
        setOnlineUsers(message.users);
      }
    };

    ws.onclose = () => {
      setConnected(false);
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempt.current), 30000);
      reconnectTimer.current = setTimeout(() => {
        reconnectAttempt.current++;
        connect();
      }, delay);
    };

    ws.onerror = () => ws.close();
  }, [nodeId, roomId, flushQueue, syncState]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, [connect]);

  const insert = useCallback(
    (position: number, char: string) => {
      const op = rgaRef.current.insertAt(position, char);
      opsCount.current++;
      syncState();

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "rga-operation", operation: op }));
      } else {
        offlineQueue.current.push(op);
      }
    },
    [syncState]
  );

  const remove = useCallback(
    (position: number) => {
      const op = rgaRef.current.deleteAt(position);
      if (op) {
        opsCount.current++;
        syncState();

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: "rga-operation", operation: op }));
        } else {
          offlineQueue.current.push(op);
        }
      }
    },
    [syncState]
  );

  const sendCursor = useCallback(
    (position: number) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "cursor",
            nodeId,
            position,
            color: userColor,
          })
        );
      }
    },
    [nodeId, userColor]
  );

  return {
    text,
    insert,
    remove,
    connected,
    nodeId,
    userColor,
    cursors,
    sendCursor,
    onlineUsers,
    stats,
    offlineQueueSize: offlineQueue.current.length,
  };
}