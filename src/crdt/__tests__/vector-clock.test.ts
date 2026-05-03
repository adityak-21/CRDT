import { describe, it, expect } from "vitest";
import { VectorClock } from "../vector-clock";

describe("VectorClock", () => {
  it("starts at zero", () => {
    const vc = new VectorClock("A");
    expect(vc.state()).toEqual({});
  });

  it("tick increments own slot", () => {
    const vc = new VectorClock("A");
    vc.tick();
    vc.tick();
    expect(vc.state()).toEqual({ A: 2 });
  });

  it("merge takes max of each slot", () => {
    const a = new VectorClock("A");
    const b = new VectorClock("B");

    a.tick(); // { A: 1 }
    a.tick(); // { A: 2 }
    b.tick(); // { B: 1 }

    a.merge(b);
    expect(a.state()).toEqual({ A: 2, B: 1 });
  });

  it("detects before relationship", () => {
    const a = new VectorClock("A");
    const b = VectorClock.fromState("B", { A: 1 });

    a.tick(); // { A: 1 }
    b.tick(); // { A: 1, B: 1 }

    // a { A: 1 } vs b { A: 1, B: 1 }
    // every slot in a <= b, and at least one is less
    expect(a.compare(b)).toBe(-1); // a happened before b
  });

  it("detects after relationship", () => {
    const a = VectorClock.fromState("A", { A: 3, B: 2 });
    const b = VectorClock.fromState("B", { A: 2, B: 1 });

    expect(a.compare(b)).toBe(1); // a happened after b
  });

  it("detects concurrent events", () => {
    const a = new VectorClock("A");
    const b = new VectorClock("B");

    a.tick(); // { A: 1 }
    b.tick(); // { B: 1 }

    // a has more A, b has more B → concurrent
    expect(a.isConcurrent(b)).toBe(true);
  });

  it("equal clocks are not concurrent", () => {
    const a = VectorClock.fromState("A", { A: 1, B: 1 });
    const b = VectorClock.fromState("B", { A: 1, B: 1 });

    expect(a.isConcurrent(b)).toBe(false);
  });

  it("serializes and deserializes", () => {
    const a = new VectorClock("A");
    a.tick();
    a.tick();

    const state = a.state();
    const b = VectorClock.fromState("B", state);

    expect(b.state()).toEqual({ A: 2 });
  });
});