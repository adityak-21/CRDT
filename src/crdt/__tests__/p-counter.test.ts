import { describe, it, expect } from "vitest";
import { PNCounter } from "../pn-counter";

describe("PNCounter", () => {
  it("starts at zero", () => {
    const counter = new PNCounter("A");
    expect(counter.value()).toBe(0);
  });

  it("increments and decrements", () => {
    const counter = new PNCounter("A");
    counter.increment();
    counter.increment();
    counter.decrement();
    expect(counter.value()).toBe(1);
  });

  it("can go negative", () => {
    const counter = new PNCounter("A");
    counter.decrement();
    counter.decrement();
    expect(counter.value()).toBe(-2);
  });

  it("merges correctly", () => {
    const a = new PNCounter("A");
    const b = new PNCounter("B");

    a.increment(); // +1
    a.increment(); // +2
    b.decrement(); // -1

    a.merge(b);
    expect(a.value()).toBe(1); // 2 - 1

    b.merge(a);
    expect(b.value()).toBe(1); // converged
  });

  it("merge is idempotent", () => {
    const a = new PNCounter("A");
    const b = new PNCounter("B");

    a.increment();
    b.decrement();

    a.merge(b);
    a.merge(b);
    expect(a.value()).toBe(0); // still 0
  });
});