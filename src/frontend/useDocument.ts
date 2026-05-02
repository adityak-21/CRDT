import { useState, useEffect, useRef, useCallback } from "react";
import { Document, Operation } from "../crdt";

function generateNodeId(): string {
  return "client-" + Math.random().toString(36).slice(2, 7);
}

export function useDocument() {

  const nodeId = useRef(generateNodeId()).current;
  const docRef = useRef(new Document(nodeId));

  const [docState, setDocState] = useState<Record<string, unknown>>({});

  const wsRef = useRef<WebSocket | null>(null);

  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:8080");
    wsRef.current = ws;

    ws.onopen = () => {
      console.log(`[${nodeId}] Connected`);
      setConnected(true);
    };

    ws.onmessage = (event: MessageEvent) => {
      const message = JSON.parse(event.data);

      if (message.type === "sync") {
        for (const op of message.operations as Operation[]) {
          docRef.current.apply(op);
        }
        setDocState(docRef.current.toJSON());
        console.log(`[${nodeId}] Synced ${message.operations.length} operations`);
      }

      if (message.type === "operation") {
        const op = message.operation as Operation;
        docRef.current.apply(op);
        setDocState(docRef.current.toJSON());
        console.log(`[${nodeId}] Received: ${op.nodeId} set "${op.field}"`);
      }
    };


    ws.onclose = () => {
      console.log(`[${nodeId}] Disconnected`);
      setConnected(false);
    };


    return () => {
      ws.close();
    };
  }, [nodeId]);


  const edit = useCallback(
    (field: string, value: unknown) => {
      const op = docRef.current.set(field, value);

      setDocState(docRef.current.toJSON());

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: "operation",
            operation: op,
          })
        );
      }
    },
    []
  );

  return { doc: docState, edit, connected, nodeId };
}