import { useState, useEffect, useRef, useCallback } from "react";
import { Document, Operation, ConflictInfo } from "../crdt";
import { RGA, RGAOperation } from "../crdt/rga";
import { saveOperation, loadOperations } from "./storage";

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

function getOrCreateNodeId(): string {
    const stored = localStorage.getItem("crdt-node-id");
    if (stored) return stored;
    const id = "user-" + Math.random().toString(36).slice(2, 6);
    localStorage.setItem("crdt-node-id", id);
    return id;
}

export interface CursorInfo {
  nodeId: string;
  x: number;
  y: number;
  color: string;
}

export function useWorkspace(roomId: string) {
  const nodeId = useRef(getOrCreateNodeId()).current;
  const userColor = useRef(getRandomColor()).current;
  const rgaRef = useRef(new RGA(nodeId));
  const docRef = useRef(new Document(nodeId));

  const [text, setText] = useState("");
  const [doc, setDoc] = useState<Record<string, unknown>>({});
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const offlineDocQueue = useRef<Operation[]>([]);
  const offlineRgaQueue = useRef<RGAOperation[]>([]);
  const reconnectAttempt = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [cursors, setCursors] = useState<Map<string, CursorInfo>>(new Map());
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);

  const rgaOpsCount = useRef(0);

  const [rgaStats, setRgaStats] = useState({
    chars: 0,
    tombstones: 0,
    ops: 0,
  });

  const syncState = useCallback(() => {
    setText(rgaRef.current.toString());
    setDoc(docRef.current.toJSON());
    setConflicts(docRef.current.getAllConflicts());

    const allNodes = rgaRef.current.getAllNodes();
    setRgaStats({
      chars: rgaRef.current.length,
      tombstones: allNodes.filter((n) => n.deleted).length,
      ops: rgaOpsCount.current,
    });
  }, []);

  const sendWs = useCallback((type: string, payload: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, ...payload }));
    }
  }, []);

    const flushQueues = useCallback(() => {
        const ws = wsRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
    
        for (const op of offlineDocQueue.current) {
        ws.send(JSON.stringify({ type: "operation", operation: op }));
        }
        offlineDocQueue.current = [];
    
        for (const op of offlineRgaQueue.current) {
        ws.send(JSON.stringify({ type: "rga-operation", operation: op }));
        }
        offlineRgaQueue.current = [];
    }, []);

    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadFromStorage() {
          const savedOps = await loadOperations(roomId + "-doc");
          for (const op of savedOps) {
            docRef.current.apply(op);
          }
      
          const savedRgaOps = await loadOperations(roomId + "-rga");
          for (const op of savedRgaOps) {
            rgaRef.current.apply(op);
            rgaOpsCount.current++;
          }
      
          syncState();
          setLoading(false);
        }
        loadFromStorage();
      }, [roomId, syncState]);

      const hasSyncedLocal = useRef(false);

    useEffect(() => {
        if (loading || !connected || hasSyncedLocal.current) return;
        hasSyncedLocal.current = true;
        
        async function pushLocalToServer() {
            const ws = wsRef.current;
            if (!ws || ws.readyState !== WebSocket.OPEN) return;
        
            const savedRgaOps = await loadOperations(roomId + "-rga");
            for (const op of savedRgaOps) {
            ws.send(JSON.stringify({ type: "rga-operation", operation: op }));
            }
        
            const savedDocOps = await loadOperations(roomId + "-doc");
            for (const op of savedDocOps) {
            ws.send(JSON.stringify({ type: "operation", operation: op }));
            }
        }
        
        pushLocalToServer();
    }, [loading, connected, roomId]);

  const connect = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      reconnectAttempt.current = 0;
      ws.send(JSON.stringify({ type: "join", roomId, nodeId }));
      flushQueues();
    };

    ws.onmessage = (event: MessageEvent) => {
      const msg = JSON.parse(event.data);

      if (msg.type === "sync") {
        for (const op of msg.operations || []) {
          docRef.current.apply(op);
          saveOperation(roomId + "-doc", op);
        }
        for (const op of msg.rgaOperations || []) {
          rgaRef.current.apply(op);
          rgaOpsCount.current++;
          saveOperation(roomId + "-rga", op);
        }
        syncState();
      }

      if (msg.type === "operation") {
        docRef.current.apply(msg.operation);
        saveOperation(roomId + "-doc", msg.operation);
        syncState();
      }

      if (msg.type === "rga-operation") {
        rgaRef.current.apply(msg.operation);
        rgaOpsCount.current++;
        saveOperation(roomId + "-rga", msg.operation);
        syncState();
      }

      if (msg.type === "cursor") {
        setCursors((prev) => {
          const next = new Map(prev);
          next.set(msg.nodeId, {
            nodeId: msg.nodeId,
            x: msg.x,
            y: msg.y,
            color: msg.color,
          });
          return next;
        });
      }

      if (msg.type === "user-left") {
        setCursors((prev) => {
          const next = new Map(prev);
          next.delete(msg.nodeId);
          return next;
        });
      }

      if (msg.type === "presence") {
        setOnlineUsers(msg.users);
      }
    };

    ws.onclose = () => {
      setConnected(false);
      const delay = Math.min(1000 * 2 ** reconnectAttempt.current, 30000);
      reconnectTimer.current = setTimeout(() => {
        reconnectAttempt.current++;
        connect();
      }, delay);
    };

    ws.onerror = () => ws.close();
  }, [nodeId, roomId, flushQueues, syncState]);

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

  const insertChar = useCallback(
    (position: number, char: string) => {
      const op = rgaRef.current.insertAt(position, char);
      rgaOpsCount.current++;
      saveOperation(roomId + "-rga", op);
      syncState();
  
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "rga-operation", operation: op }));
      } else {
        offlineRgaQueue.current.push(op);
      }
    },
    [syncState, roomId]
  );

  const deleteChar = useCallback(
    (position: number) => {
      const op = rgaRef.current.deleteAt(position);
      if (op) {
        rgaOpsCount.current++;
        saveOperation(roomId + "-rga", op);
        syncState();
  
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: "rga-operation", operation: op }));
        } else {
          offlineRgaQueue.current.push(op);
        }
      }
    },
    [syncState, roomId]
  );

  const editField = useCallback(
    (field: string, value: unknown) => {
      const op = docRef.current.set(field, value);
      saveOperation(roomId + "-doc", op);
      syncState();
  
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "operation", operation: op }));
      } else {
        offlineDocQueue.current.push(op);
      }
    },
    [syncState, roomId]
  );

  const incrementField = useCallback(
    (field: string) => {
      const current = (docRef.current.toJSON()[field] as number) || 0;
      editField(field, current + 1);
    },
    [editField]
  );

  const decrementField = useCallback(
    (field: string) => {
      const current = (docRef.current.toJSON()[field] as number) || 0;
      editField(field, current - 1);
    },
    [editField]
  );

  const sendCursor = useCallback(
    (x: number, y: number) => {
      sendWs("cursor", { nodeId, x, y, color: userColor });
    },
    [nodeId, userColor, sendWs]
  );

  const dismissConflict = useCallback(
    (field: string) => {
      docRef.current.dismissConflict(field);
      setConflicts(docRef.current.getAllConflicts());
    },
    []
  );

  return {
    text,
    insertChar,
    deleteChar,
    rgaStats,
    doc,
    editField,
    incrementField,
    decrementField,
    conflicts,
    dismissConflict,
    connected,
    nodeId,
    userColor,
    cursors,
    sendCursor,
    onlineUsers,
    loading,
    offlineQueueSize:
      offlineDocQueue.current.length + offlineRgaQueue.current.length,
  };
}