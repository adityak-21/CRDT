import { describe, it, expect } from "vitest";
import { Document } from "../document";

describe("Document", () => {
  it("sets and gets fields", () => {
    const doc = new Document("A");
    doc.set("title", "Hello");
    doc.set("body", "World");

    expect(doc.get("title")).toBe("Hello");
    expect(doc.get("body")).toBe("World");
  });

  it("returns null for unset fields", () => {
    const doc = new Document("A");
    expect(doc.get("title")).toBeNull();
  });

  it("applies remote operations", () => {
    const a = new Document("A");
    const b = new Document("B");

    const op = a.set("title", "Hello from A");
    b.apply(op);

    expect(b.get("title")).toBe("Hello from A");
  });

  it("last writer wins for same field", () => {
    const a = new Document("A");
    const b = new Document("B");

    const op1 = a.set("title", "A's title");

    // Small delay to ensure different timestamps
    const op2 = b.set("title", "B's title");
    // Manually make B's timestamp higher
    op2.timestamp = op1.timestamp + 100;

    a.apply(op2);
    b.apply(op1);

    // Both should have B's title (higher timestamp)
    expect(a.get("title")).toBe("B's title");
    expect(b.get("title")).toBe("B's title");
  });

  it("different fields don't conflict", () => {
    const a = new Document("A");
    const b = new Document("B");

    const op1 = a.set("title", "A's title");
    const op2 = b.set("body", "B's body");

    a.apply(op2);
    b.apply(op1);

    // Both have both fields
    expect(a.get("title")).toBe("A's title");
    expect(a.get("body")).toBe("B's body");
    expect(b.get("title")).toBe("A's title");
    expect(b.get("body")).toBe("B's body");
  });

  it("detects concurrent conflicts", () => {
    const a = new Document("A");
    const b = new Document("B");

    // Both edit the same field without seeing each other's edit
    a.set("title", "A's version");
    const opB = b.set("title", "B's version");
    opB.timestamp = Date.now() + 1000; // B wins by timestamp

    const opA = a.set("title", "A's version");

    // Apply B's op to A — should detect conflict
    a.apply(opB);
    const conflicts = a.getAllConflicts();

    expect(conflicts.length).toBeGreaterThan(0);
    expect(conflicts[0].field).toBe("title");
  });

  it("dismisses conflicts", () => {
    const a = new Document("A");
    const b = new Document("B");

    a.set("title", "A's version");
    const opB = b.set("title", "B's version");
    opB.timestamp = Date.now() + 1000;

    a.apply(opB);
    expect(a.getAllConflicts().length).toBeGreaterThan(0);

    a.dismissConflict("title");
    expect(a.getAllConflicts().length).toBe(0);
  });

  it("editing a field clears its conflict", () => {
    const a = new Document("A");
    const b = new Document("B");

    a.set("title", "A's version");
    const opB = b.set("title", "B's version");
    opB.timestamp = Date.now() + 1000;

    a.apply(opB);
    expect(a.getAllConflicts().length).toBeGreaterThan(0);

    // A edits title again — conflict should clear
    a.set("title", "A's new version");
    expect(a.getAllConflicts().length).toBe(0);
  });

  it("toJSON returns all fields", () => {
    const doc = new Document("A");
    doc.set("title", "Hello");
    doc.set("status", "draft");

    expect(doc.toJSON()).toEqual({
      title: "Hello",
      status: "draft",
    });
  });
});