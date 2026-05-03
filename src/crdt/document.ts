import { LWWRegister } from "./lww-register";
import { VectorClock } from "./vector-clock";

export interface Operation {
  field: string;
  value: unknown;
  timestamp: number;
  nodeId: string;
  clock: Record<string, number>;
}

export interface ConflictInfo {
  field: string;
  winner: string;
  loser: string;
  winningValue: unknown;
  losingValue: unknown;
  timestamp: number;
}

export class Document {
  private fields: Map<string, LWWRegister<unknown>> = new Map();
  private clock: VectorClock;
  private nodeId: string;

  private conflicts: Map<string, ConflictInfo> = new Map();
  private fieldClocks: Map<string, VectorClock> = new Map();

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

    this.fieldClocks.set(
      field,
      VectorClock.fromState(this.nodeId, this.clock.state())
    );

    this.conflicts.delete(field);

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
    const myFieldClock = this.fieldClocks.get(op.field);
    const remoteClock = VectorClock.fromState(this.nodeId, op.clock);

    let isConcurrent = false;
    if (myFieldClock) {
      isConcurrent = myFieldClock.isConcurrent(remoteClock);
    }

    const oldValue = this.get(op.field);

    const remoteRegister = new LWWRegister<unknown>(op.nodeId);
    remoteRegister.set(op.value, op.timestamp);

    if (!this.fields.has(op.field)) {
      this.fields.set(op.field, new LWWRegister<unknown>(this.nodeId));
    }

    this.fields.get(op.field)!.merge(remoteRegister);

    if (isConcurrent && oldValue !== undefined && oldValue !== null) {
      const newValue = this.get(op.field);
      const theyWon = newValue === op.value;

      this.conflicts.set(op.field, {
        field: op.field,
        winner: theyWon ? op.nodeId : this.nodeId,
        loser: theyWon ? this.nodeId : op.nodeId,
        winningValue: newValue,
        losingValue: theyWon ? oldValue : op.value,
        timestamp: Date.now(),
      });
    }

    this.clock.merge(remoteClock);
  }

  getConflict(field: string): ConflictInfo | null {
    return this.conflicts.get(field) ?? null;
  }

  getAllConflicts(): ConflictInfo[] {
    return Array.from(this.conflicts.values());
  }

  dismissConflict(field: string): void {
    this.conflicts.delete(field);
  }

  toJSON(): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [field, register] of this.fields) {
      result[field] = register.get();
    }
    return result;
  }
}