import { describe, it, expect } from "vitest";
import { RGA } from "../../crdt/rga";

describe("RGA — Replicated Growable Array", () => {
  it("inserts characters in order", () => {
    const rga = new RGA("alice");
    rga.insertAt(0, "H");
    rga.insertAt(1, "i");
    expect(rga.toString()).toBe("Hi");
  });

  it("inserts at the beginning", () => {
    const rga = new RGA("alice");
    rga.insertAt(0, "B");
    rga.insertAt(0, "A");
    expect(rga.toString()).toBe("AB");
  });

  it("inserts in the middle", () => {
    const rga = new RGA("alice");
    rga.insertAt(0, "A");
    rga.insertAt(1, "C");
    rga.insertAt(1, "B"); // between A and C
    expect(rga.toString()).toBe("ABC");
  });

  it("deletes a character", () => {
    const rga = new RGA("alice");
    rga.insertAt(0, "A");
    rga.insertAt(1, "B");
    rga.insertAt(2, "C");
    rga.deleteAt(1); // delete 'B'
    expect(rga.toString()).toBe("AC");
  });

  it("handles concurrent inserts at the same position — both preserved", () => {
    const alice = new RGA("alice");
    const bob = new RGA("bob");

    // Both start with "Hello "
    const ops: any[] = [];
    for (const ch of "Hello ") {
      const op = alice.insertAt(alice.length, ch);
      ops.push(op);
    }
    // Sync to Bob
    for (const op of ops) {
      bob.apply(op);
    }
    expect(alice.toString()).toBe("Hello ");
    expect(bob.toString()).toBe("Hello ");

    // Alice types "World" at position 6
    const aliceOps = [];
    for (let i = 0; i < "World".length; i++) {
      aliceOps.push(alice.insertAt(6 + i, "World"[i]));
    }

    // Bob types "Earth" at position 6 (concurrent — hasn't seen Alice's ops)
    const bobOps = [];
    for (let i = 0; i < "Earth".length; i++) {
      bobOps.push(bob.insertAt(6 + i, "Earth"[i]));
    }

    // Now sync: apply Alice's ops to Bob, Bob's ops to Alice
    for (const op of aliceOps) {
      bob.apply(op);
    }
    for (const op of bobOps) {
      alice.apply(op);
    }

    // Both should have the same result
    expect(alice.toString()).toBe(bob.toString());

    // Both "World" and "Earth" should be preserved
    const result = alice.toString();
    expect(result).toContain("World");
    expect(result).toContain("Earth");
    expect(result.startsWith("Hello ")).toBe(true);
  });

  it("handles concurrent deletes — same character", () => {
    const alice = new RGA("alice");
    const bob = new RGA("bob");

    // Both start with "ABC"
    const ops = [];
    for (const ch of "ABC") {
      ops.push(alice.insertAt(alice.length, ch));
    }
    for (const op of ops) {
      bob.apply(op);
    }

    // Both delete 'B' concurrently
    const aliceOp = alice.deleteAt(1);
    const bobOp = bob.deleteAt(1);

    // Sync
    if (aliceOp) bob.apply(aliceOp);
    if (bobOp) alice.apply(bobOp);

    // Both should have "AC"
    expect(alice.toString()).toBe("AC");
    expect(bob.toString()).toBe("AC");
  });

  it("handles insert after a deleted character", () => {
    const alice = new RGA("alice");
    const bob = new RGA("bob");

    // Both start with "ABC"
    const ops = [];
    for (const ch of "ABC") {
      ops.push(alice.insertAt(alice.length, ch));
    }
    for (const op of ops) {
      bob.apply(op);
    }

    // Alice inserts 'X' after 'B' (position 2)
    const insertOp = alice.insertAt(2, "X");

    // Bob deletes 'B' concurrently
    const deleteOp = bob.deleteAt(1);

    // Sync
    bob.apply(insertOp);
    alice.apply(deleteOp!);

    // Both should converge
    expect(alice.toString()).toBe(bob.toString());

    // 'X' should still be there (its parent 'B' is tombstoned but exists)
    expect(alice.toString()).toContain("X");
    expect(alice.toString()).toContain("A");
    expect(alice.toString()).toContain("C");
    expect(alice.toString()).not.toContain("B");
  });

  it("operations are idempotent — applying twice does nothing", () => {
    const alice = new RGA("alice");
    const op = alice.insertAt(0, "A");

    const bob = new RGA("bob");
    bob.apply(op);
    bob.apply(op); // duplicate
    bob.apply(op); // triplicate

    expect(bob.toString()).toBe("A");
    expect(bob.length).toBe(1);
  });

  it("three concurrent editors all converge", () => {
    const alice = new RGA("alice");
    const bob = new RGA("bob");
    const charlie = new RGA("charlie");

    // Start with "Go"
    const initial = [];
    for (const ch of "Go") {
      initial.push(alice.insertAt(alice.length, ch));
    }
    for (const op of initial) {
      bob.apply(op);
      charlie.apply(op);
    }

    // Alice inserts "od" → "Good"
    const aOps = [];
    aOps.push(alice.insertAt(2, "o"));
    aOps.push(alice.insertAt(3, "d"));

    // Bob inserts "lf" → "Golf"
    const bOps = [];
    bOps.push(bob.insertAt(2, "l"));
    bOps.push(bob.insertAt(3, "f"));

    // Charlie inserts "ne" → "Gone"
    const cOps = [];
    cOps.push(charlie.insertAt(2, "n"));
    cOps.push(charlie.insertAt(3, "e"));

    // Full sync — everyone gets everyone else's ops
    for (const op of aOps) {
      bob.apply(op);
      charlie.apply(op);
    }
    for (const op of bOps) {
      alice.apply(op);
      charlie.apply(op);
    }
    for (const op of cOps) {
      alice.apply(op);
      bob.apply(op);
    }

    // All three must converge to the exact same string
    expect(alice.toString()).toBe(bob.toString());
    expect(bob.toString()).toBe(charlie.toString());

    // All characters preserved
    const result = alice.toString();
    expect(result).toContain("Go");
  });

  it("handles rapid typing — sequential inserts", () => {
    const rga = new RGA("alice");
    const text = "The quick brown fox jumps over the lazy dog";

    for (let i = 0; i < text.length; i++) {
      rga.insertAt(i, text[i]);
    }

    expect(rga.toString()).toBe(text);
  });

  it("handles backspace — delete from end", () => {
    const rga = new RGA("alice");
    for (const ch of "Hello!") {
      rga.insertAt(rga.length, ch);
    }

    // Backspace 3 times
    rga.deleteAt(rga.length - 1); // delete '!'
    rga.deleteAt(rga.length - 1); // delete 'o'
    rga.deleteAt(rga.length - 1); // delete 'l'

    expect(rga.toString()).toBe("Hel");
  });

  it("reports correct length after deletes", () => {
    const rga = new RGA("alice");
    rga.insertAt(0, "A");
    rga.insertAt(1, "B");
    rga.insertAt(2, "C");

    expect(rga.length).toBe(3);

    rga.deleteAt(1);
    expect(rga.length).toBe(2);

    rga.deleteAt(0);
    expect(rga.length).toBe(1);
  });
});

describe("garbage collection", () => {
    it("should collect tombstones with no live children", () => {
        const rga = new RGA("alice");
      
        // Insert "abc"
        rga.insertAt(0, "a");
        rga.insertAt(1, "b");
        rga.insertAt(2, "c");
      
        // Delete "c" (last char — no children)
        rga.deleteAt(2);
      
        expect(rga.toString()).toBe("ab");
        const before = rga.getAllNodes();
        expect(before.filter(n => n.deleted).length).toBe(1);
      
        const collected = rga.garbageCollect(100);
        expect(collected).toBe(1);
      
        expect(rga.toString()).toBe("ab");
        expect(rga.getAllNodes().filter(n => n.deleted).length).toBe(0);
      });
  
    it("should NOT collect tombstones with live children", () => {
      const rga = new RGA("alice");
  
      // Insert "ab"
      rga.insertAt(0, "a");
      rga.insertAt(1, "b");
  
      // Delete "a" — but "b" references "a" as parent
      rga.deleteAt(0);
  
      expect(rga.toString()).toBe("b");
  
      // Try GC — should NOT collect "a" because "b" references it
      const collected = rga.garbageCollect(100);
      expect(collected).toBe(0);
    });
});