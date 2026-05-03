import { useState, useEffect, useRef, useCallback } from "react";
import { Document, Operation, ConflictInfo } from "../crdt";

function generateNodeId(): string {
  return "client-" + Math.random().toString(36).slice(2, 7);
}

export function useDocument() {
  const nodeId = useRef(generateNodeId()).current;
  const docRef = useRef(new Document(nodeId));
  const [docState, setDocState] = useState<Record<string, unknown>>({});
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);

  const [conflicts, setConflicts] = useState<ConflictInfo[]>([]);

  const offlineQueue = useRef<Operation[]>([]);

  const reconnectAttempt = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushQueue = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    console.log(`[${nodeId}] Flushing ${offlineQueue.current.length} queued operations`);

    for (const op of offlineQueue.current) {
      ws.send(JSON.stringify({ type: "operation", operation: op }));
    }

    offlineQueue.current = [];
  }, [nodeId]);

  const connect = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket("ws://localhost:8080");
    wsRef.current = ws;

    ws.onopen = () => {
      console.log(`[${nodeId}] Connected`);
      setConnected(true);
      reconnectAttempt.current = 0;
      flushQueue();
    };

    ws.onmessage = (event: MessageEvent) => {
      const message = JSON.parse(event.data);

      if (message.type === "sync") {
        for (const op of message.operations as Operation[]) {
          docRef.current.apply(op);
        }
        setDocState(docRef.current.toJSON());
        setConflicts(docRef.current.getAllConflicts());
        console.log(`[${nodeId}] Synced ${message.operations.length} operations`);
      }

      if (message.type === "operation") {
        const op = message.operation as Operation;
        docRef.current.apply(op);
        setDocState(docRef.current.toJSON());
        setConflicts(docRef.current.getAllConflicts());
        console.log(`[${nodeId}] Received: ${op.nodeId} set "${op.field}"`);
      }
    };

    ws.onclose = () => {
      console.log(`[${nodeId}] Disconnected`);
      setConnected(false);

      const delay = Math.min(1000 * Math.pow(2, reconnectAttempt.current), 30000);
      console.log(`[${nodeId}] Reconnecting in ${delay}ms...`);

      reconnectTimer.current = setTimeout(() => {
        reconnectAttempt.current++;
        connect();
      }, delay);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [nodeId, flushQueue]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, [connect]);

  const edit = useCallback(
    (field: string, value: unknown) => {
      const op = docRef.current.set(field, value);
      setDocState(docRef.current.toJSON());
      setConflicts(docRef.current.getAllConflicts());

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "operation", operation: op }));
      } else {
        console.log(`[${nodeId}] Offline — queued operation`);
        offlineQueue.current.push(op);
      }
    },
    [nodeId]
  );

  const dismissConflict = useCallback((field: string) => {
    docRef.current.dismissConflict(field);
    setConflicts(docRef.current.getAllConflicts());
  }, []);

  return {
    doc: docState,
    edit,
    connected,
    nodeId,
    conflicts,
    dismissConflict,
    offlineQueueSize: offlineQueue.current.length,
  };
}