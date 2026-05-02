import { Client } from "./client";

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const alice = new Client("alice");
  const bob = new Client("bob");

  await alice.connect();
  await bob.connect();
  await sleep(100);

  console.log("\n--- Alice edits title ---");
  alice.edit("title", "Meeting Notes");
  await sleep(100);

  console.log("\n--- Bob edits body ---");
  bob.edit("body", "Discuss project timeline");
  await sleep(100);

  console.log("\n--- Both edit status at the same time ---");
  alice.edit("status", "draft");
  bob.edit("status", "final");
  await sleep(100);

  console.log("\n--- Final states ---");
  console.log("Alice:", alice.getState());
  console.log("Bob:", bob.getState());

  alice.disconnect();
  bob.disconnect();

  await sleep(100);
  process.exit(0);
}

main();