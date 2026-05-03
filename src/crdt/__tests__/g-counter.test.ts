import { describe, it, expect } from "vitest";
import { GCounter } from "../g-counter";

describe("GCounter", () => {
  it("starts at zero", () => {
    const counter = new GCounter("A");
    expect(counter.value()).toBe(0);
  });

  it("increments locally", () => {
    const counter = new GCounter("A");
    counter.increment();
    counter.increment();
    counter.increment();
    expect(counter.value()).toBe(3);
  });

  it("merges two counters correctly", () => {
    const a = new GCounter("A");
    const b = new GCounter("B");

    a.increment(); // A: { A: 1 }
    a.increment(); // A: { A: 2 }
    b.increment(); // B: { B: 1 }

    a.merge(b);
    expect(a.value()).toBe(3); // 2 + 1

    b.merge(a);
    expect(b.value()).toBe(3); // converged
  });

  it("merge is idempotent (merging twice = same result)", () => {
    const a = new GCounter("A");
    const b = new GCounter("B");

    a.increment();
    b.increment();

    a.merge(b);
    a.merge(b); // merge again
    expect(a.value()).toBe(2); // still 2, not 3
  });

  it("merge is commutative (order doesn't matter)", () => {
    const a = new GCounter("A");
    const b = new GCounter("B");
    const c = new GCounter("C");

    a.increment();
    b.increment();
    b.increment();
    c.increment();

    // Clone a into two copies
    const a1 = GCounter.fromState("A", a.state());
    const a2 = GCounter.fromState("A", a.state());

    // Merge in different orders
    a1.merge(b);
    a1.merge(c);

    a2.merge(c);
    a2.merge(b);

    expect(a1.value()).toBe(a2.value()); // same result regardless of order
  });

  it("serializes and deserializes correctly", () => {
    const a = new GCounter("A");
    a.increment();
    a.increment();

    const state = a.state();
    const b = GCounter.fromState("B", state);

    expect(b.value()).toBe(2);
  });
});