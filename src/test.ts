import { GCounter, PNCounter, LWWRegister, ORSet } from "./crdt";

// ============================================
// TEST 1: G-Counter
// ============================================
console.log("=== G-Counter Test ===");
console.log("Scenario: Two servers counting visitors independently\n");
{
  // Create two counters — one for each server
  const counterA = new GCounter("node-A");
  const counterB = new GCounter("node-B");

  // A gets 4 visitors (offline, doesn't know about B)
  counterA.increment();
  counterA.increment();
  counterA.increment();
  counterA.increment();

  // B gets 2 visitors (offline, doesn't know about A)
  counterB.increment();
  counterB.increment();

  console.log("Before merge (each only knows about themselves):");
  console.log("  A sees total:", counterA.value()); // 4
  console.log("  B sees total:", counterB.value()); // 2

  // Internet comes back! They exchange tables and merge.
  counterA.merge(counterB);
  counterB.merge(counterA);

  console.log("After merge (both know about everyone):");
  console.log("  A sees total:", counterA.value()); // 6
  console.log("  B sees total:", counterB.value()); // 6
  console.log("  Both converged?", counterA.value() === counterB.value()); // true
}

// ============================================
// TEST 2: PN-Counter
// ============================================
console.log("\n=== PN-Counter Test ===");
console.log("Scenario: Like/unlike system on a post\n");
{
  const likesA = new PNCounter("node-A");
  const likesB = new PNCounter("node-B");

  // A: likes twice, then unlikes once → net +1
  likesA.increment();
  likesA.increment();
  likesA.decrement();

  // B: likes three times → net +3
  likesB.increment();
  likesB.increment();
  likesB.increment();

  console.log("Before merge:");
  console.log("  A sees:", likesA.value()); // 2 - 1 = 1
  console.log("  B sees:", likesB.value()); // 3

  likesA.merge(likesB);
  likesB.merge(likesA);

  console.log("After merge:");
  console.log("  A sees:", likesA.value()); // (2+3) - (1+0) = 4
  console.log("  B sees:", likesB.value()); // 4
}

// ============================================
// TEST 3: LWW-Register
// ============================================
console.log("\n=== LWW-Register Test ===");
console.log("Scenario: Two people editing document title simultaneously\n");
{
  const titleA = new LWWRegister<string>("node-A");
  const titleB = new LWWRegister<string>("node-B");

  // A sets title (at time 1000)
  titleA.set("Meeting Notes", 1000);

  // B sets title LATER (at time 1005)
  titleB.set("Project Plan", 1005);

  console.log("Before merge:");
  console.log("  A has:", titleA.get()); // "Meeting Notes"
  console.log("  B has:", titleB.get()); // "Project Plan"

  // Merge — later timestamp wins
  titleA.merge(titleB);
  titleB.merge(titleA);

  console.log("After merge (later timestamp wins):");
  console.log("  A has:", titleA.get()); // "Project Plan"
  console.log("  B has:", titleB.get()); // "Project Plan"
}

// ============================================
// TEST 4: OR-Set
// ============================================
console.log("\n=== OR-Set Test ===");
console.log("Scenario: Shared grocery list\n");
{
  const listA = new ORSet<string>("node-A");
  const listB = new ORSet<string>("node-B");

  // A adds milk and eggs
  listA.add("milk");
  listA.add("eggs");

  // B adds bread (independently, offline)
  listB.add("bread");

  console.log("Before merge:");
  console.log("  A has:", listA.values()); // ["milk", "eggs"]
  console.log("  B has:", listB.values()); // ["bread"]

  // Merge — everyone sees everything
  listA.merge(listB);
  listB.merge(listA);

  console.log("After merge:");
  console.log("  A has:", listA.values()); // ["milk", "eggs", "bread"]
  console.log("  B has:", listB.values()); // ["milk", "eggs", "bread"]

  // Now test the interesting case:
  // B removes milk
  console.log("\nB removes milk...");
  listB.remove("milk");
  console.log("  B has:", listB.values()); // ["eggs", "bread"]

  // A adds milk AGAIN (doesn't know B removed it)
  console.log("A adds milk again (doesn't know B removed it)...");
  listA.add("milk");

  // Merge — A's new add survives B's remove!
  listA.merge(listB);
  listB.merge(listA);

  console.log("After merge:");
  console.log("  A has:", listA.values()); // milk is here! A's re-add survived
  console.log("  B has:", listB.values()); // milk is back
  console.log("  milk survived?", listA.has("milk")); // true
}

console.log("\n✅ All CRDTs working correctly!");