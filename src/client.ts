import WebSocket from "ws";
import { Document, Operation } from "./crdt";

export class Client {
  private doc: Document;
  private ws: WebSocket | null = null;
  private nodeId: string;

  constructor(nodeId: string) {
    this.nodeId = nodeId;
    this.doc = new Document(nodeId);
  }

  connect(url = "ws://localhost:8080"): Promise<void> {
    return new Promise((resolve) => {
      this.ws = new WebSocket(url);

      this.ws.on("open", () => {
        console.log(`[${this.nodeId}] Connected to server`);
        resolve();
      });

      this.ws.on("message", (data: Buffer) => {
        const message = JSON.parse(data.toString());

        if (message.type === "sync") {
          console.log(`[${this.nodeId}] Syncing ${message.operations.length} past operations`);
          for (const op of message.operations as Operation[]) {
            this.doc.apply(op);
          }
          console.log(`[${this.nodeId}] State after sync:`, this.doc.toJSON());
        }

        if (message.type === "operation") {
          const op = message.operation as Operation;
          this.doc.apply(op);
          console.log(`[${this.nodeId}] Received: ${op.nodeId} set "${op.field}" = "${op.value}"`);
          console.log(`[${this.nodeId}] State:`, this.doc.toJSON());
        }
      });
    });
  }

  edit(field: string, value: unknown): void {
    const op = this.doc.set(field, value);

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: "operation",
        operation: op,
      }));
    }

    console.log(`[${this.nodeId}] Edited: "${field}" = "${value}"`);
    console.log(`[${this.nodeId}] State:`, this.doc.toJSON());
  }

  getState(): Record<string, unknown> {
    return this.doc.toJSON();
  }


  disconnect(): void {
    this.ws?.close();
  }
}