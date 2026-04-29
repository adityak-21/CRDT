export class GCounter {
  private counts: Map<string, number>;
  private nodeId: string;

  constructor(nodeId: string) {
    this.nodeId = nodeId;
    this.counts = new Map();
  }


  increment(amount = 1): void {
    const current = this.counts.get(this.nodeId) ?? 0;
    this.counts.set(this.nodeId, current + amount);
  }


  value(): number {
    let total = 0;
    for (const count of this.counts.values()) {
      total += count;
    }
    return total;
  }

  merge(other: GCounter): void {
    for (const [nodeId, count] of other.counts) {
      const myCount = this.counts.get(nodeId) ?? 0;
      this.counts.set(nodeId, Math.max(myCount, count));
    }
  }

  state(): Record<string, number> {
    return Object.fromEntries(this.counts);
  }

  static fromState(nodeId: string, state: Record<string, number>): GCounter {
    const counter = new GCounter(nodeId);
    counter.counts = new Map(Object.entries(state));
    return counter;
  }
}