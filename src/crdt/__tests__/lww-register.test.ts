import { describe, it, expect } from "vitest";
import { LWWRegister } from "../lww-register";

describe("LWWRegister", () => {
  it("stores and retrieves a value", () => {
    const reg = new LWWRegister<string>("A");
    reg.set("hello", 100);
    expect(reg.get()).toBe("hello");
  });

  it("later timestamp wins", () => {
    const a = new LWWRegister<string>("A");
    const b = new LWWRegister<string>("B");

    a.set("first", 100);
    b.set("second", 200);

    a.merge(b);
    expect(a.get()).toBe("second"); // 200 > 100
  });

  it("earlier timestamp loses", () => {
    const a = new LWWRegister<string>("A");
    const b = new LWWRegister<string>("B");

    a.set("first", 200);
    b.set("second", 100);

    a.merge(b);
    expect(a.get()).toBe("first"); // 200 > 100, a keeps its value
  });

  it("merge is idempotent", () => {
    const a = new LWWRegister<string>("A");
    const b = new LWWRegister<string>("B");

    a.set("aaa", 100);
    b.set("bbb", 200);

    a.merge(b);
    a.merge(b);
    expect(a.get()).toBe("bbb");
  });

  it("both converge to the same value", () => {
    const a = new LWWRegister<string>("A");
    const b = new LWWRegister<string>("B");

    a.set("from-a", 100);
    b.set("from-b", 200);

    a.merge(b);
    b.merge(a);

    expect(a.get()).toBe(b.get()); // both same value
  });
});