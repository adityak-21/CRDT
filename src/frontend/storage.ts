import { openDB, IDBPDatabase } from "idb";
import { Operation } from "../crdt";

const DB_NAME = "crdt-sync";
const DB_VERSION = 1;
const STORE_NAME = "operations";

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, {
            keyPath: "id",
            autoIncrement: true,
          });
          store.createIndex("roomId", "roomId");
        }
      },
    });
  }
  return dbPromise;
}

export async function saveOperation(
  roomId: string,
  op: Operation
): Promise<void> {
  const db = await getDB();
  await db.add(STORE_NAME, { roomId, operation: op });
}

export async function loadOperations(roomId: string): Promise<Operation[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex(STORE_NAME, "roomId", roomId);
  return all.map((entry) => entry.operation);
}

export async function listRooms(): Promise<string[]> {
  const db = await getDB();
  const all = await db.getAll(STORE_NAME);

  const rooms = new Set<string>();
  for (const entry of all) {
    rooms.add(entry.roomId);
  }
  return Array.from(rooms);
}


export async function clearRoom(roomId: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const index = tx.store.index("roomId");
  let cursor = await index.openCursor(roomId);
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
}