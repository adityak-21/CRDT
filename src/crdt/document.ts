import { LWWRegister } from "./lww-register";
import { VectorClock } from "./vector-clock";

export interface Operation {
  field: string;
  value: unknown;
  timestamp: number;
  nodeId: string;
  clock: Record<string, number>;
}

export class Document {
  private fields: Map<string, LWWRegister<unknown>> = new Map();
  private clock: VectorClock;
  private nodeId: string;

  constructor(nodeId: string) {
    this.nodeId = nodeId;
    this.clock = new VectorClock(nodeId);
  }

  set(field: string, value: unknown): Operation {
    this.clock.tick();

    if (!this.fields.has(field)) {
      this.fields.set(field, new LWWRegister<unknown>(this.nodeId));
    }

    const timestamp = Date.now();
    this.fields.get(field)!.set(value, timestamp);

    return {
      field,
      value,
      timestamp,
      nodeId: this.nodeId,
      clock: this.clock.state(),
    };
  }

  get(field: string): unknown | null {
    const register = this.fields.get(field);
    return register ? register.get() : null;
  }

  apply(op: Operation): void {
    const remoteRegister = new LWWRegister<unknown>(op.nodeId);
    remoteRegister.set(op.value, op.timestamp);

    if (!this.fields.has(op.field)) {
      this.fields.set(op.field, new LWWRegister<unknown>(this.nodeId));
    }

    this.fields.get(op.field)!.merge(remoteRegister);

    const remoteClock = VectorClock.fromState(this.nodeId, op.clock);
    this.clock.merge(remoteClock);
  }


  toJSON(): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [field, register] of this.fields) {
      result[field] = register.get();
    }
    return result;
  }
}