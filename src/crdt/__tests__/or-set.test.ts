import { describe, it, expect } from "vitest";
import { ORSet } from "../or-set";

describe("ORSet", () => {
  it("adds and checks elements", () => {
    const set = new ORSet<string>("A");
    set.add("milk");
    expect(set.has("milk")).toBe(true);
    expect(set.has("bread")).toBe(false);
  });

  it("removes elements", () => {
    const set = new ORSet<string>("A");
    set.add("milk");
    set.remove("milk");
    expect(set.has("milk")).toBe(false);
  });

  it("merges adds from both sides", () => {
    const a = new ORSet<string>("A");
    const b = new ORSet<string>("B");

    a.add("milk");
    b.add("bread");

    a.merge(b);
    expect(a.has("milk")).toBe(true);
    expect(a.has("bread")).toBe(true);
  });

  it("add wins over remove from different node (concurrent)", () => {
    const a = new ORSet<string>("A");
    const b = new ORSet<string>("B");

    // Both start with milk
    a.add("milk");
    a.merge(b);
    b.merge(a);

    // B removes milk
    b.remove("milk");

    // A adds milk again (doesn't know B removed it — new tag)
    a.add("milk");

    // Merge
    a.merge(b);
    b.merge(a);

    // Milk should survive — A's new add has a tag B never saw
    expect(a.has("milk")).toBe(true);
    expect(b.has("milk")).toBe(true);
  });

  it("remove wins when no concurrent add", () => {
    const a = new ORSet<string>("A");
    const b = new ORSet<string>("B");

    // A adds milk, both sync
    a.add("milk");
    a.merge(b);
    b.merge(a);

    // B removes milk (no one re-adds it)
    b.remove("milk");

    a.merge(b);
    expect(a.has("milk")).toBe(false); // gone
  });

  it("merge is idempotent", () => {
    const a = new ORSet<string>("A");
    const b = new ORSet<string>("B");

    a.add("milk");
    b.add("bread");

    a.merge(b);
    a.merge(b);

    expect(a.values().sort()).toEqual(["bread", "milk"]);
  });

  it("handles add-remove-add cycle", () => {
    const set = new ORSet<string>("A");
    set.add("milk");
    set.remove("milk");
    set.add("milk"); // new tag

    expect(set.has("milk")).toBe(true);
  });
});