export class VectorClock {
    private clock: Map<string, number>;
    private nodeId: string;
  
    constructor(nodeId: string) {
      this.nodeId = nodeId;
      this.clock = new Map();
    }

    tick(): VectorClock {
      const current = this.clock.get(this.nodeId) ?? 0;
      this.clock.set(this.nodeId, current + 1);
      return this;
    }

    merge(other: VectorClock): VectorClock {
      for (const [nodeId, count] of other.clock) {
        const myCount = this.clock.get(nodeId) ?? 0;
        this.clock.set(nodeId, Math.max(myCount, count));
      }
      return this;
    }

    compare(other: VectorClock): -1 | 0 | 1 {
      let isBefore = false;
      let isAfter = false;
  
      const allNodes = new Set([...this.clock.keys(), ...other.clock.keys()]);
  
      for (const nodeId of allNodes) {
        const myCount = this.clock.get(nodeId) ?? 0;
        const theirCount = other.clock.get(nodeId) ?? 0;
  
        if (myCount < theirCount) {
          isBefore = true; // at least one of my slots is behind
        }
        if (myCount > theirCount) {
          isAfter = true; // at least one of my slots is ahead
        }
      }
  
      if (isBefore && isAfter) return 0;
      if (isBefore) return -1;
      if (isAfter) return 1;
      return 0;
    }

    isConcurrent(other: VectorClock): boolean {
      return this.compare(other) === 0 &&
        JSON.stringify(this.state()) !== JSON.stringify(other.state());
    }

    state(): Record<string, number> {
      return Object.fromEntries(this.clock);
    }

    static fromState(nodeId: string, state: Record<string, number>): VectorClock {
      const vc = new VectorClock(nodeId);
      vc.clock = new Map(Object.entries(state));
      return vc;
    }
  }