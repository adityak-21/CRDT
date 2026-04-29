import { GCounter } from "./g-counter";

export class PNCounter {
  private positive: GCounter;
  private negative: GCounter;
  private nodeId: string;

  constructor(nodeId: string) {
    this.nodeId = nodeId;
    this.positive = new GCounter(nodeId);
    this.negative = new GCounter(nodeId);
  }


  increment(amount = 1): void {
    this.positive.increment(amount);
  }


  decrement(amount = 1): void {
    this.negative.increment(amount);
  }


  value(): number {
    return this.positive.value() - this.negative.value();
  }


  merge(other: PNCounter): void {
    this.positive.merge(other.positive);
    this.negative.merge(other.negative);
  }

  state(): { positive: Record<string, number>; negative: Record<string, number> } {
    return {
      positive: this.positive.state(),
      negative: this.negative.state(),
    };
  }
}