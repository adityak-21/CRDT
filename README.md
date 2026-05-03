# ⚡ CRDT Workspace

A real-time collaborative workspace built entirely from scratch using **CRDTs (Conflict-free Replicated Data Types)** — the same technology behind Google Docs, Figma, and Notion.

**No libraries. No Yjs. No Automerge. Every CRDT implemented from first principles.**

> 🚀 **Live Demo:** [](To Add)
>
> Open in two browser tabs. Type in both. Add tasks in both. Vote in both. Watch everything merge in real time.

---

## What is this?

A collaborative workspace where multiple users can simultaneously:

- ✏️ **Edit a shared document** — character-level text merge, zero data loss
- ✅ **Manage a task board** — add, remove, assign, and prioritize tasks
- 🗳 **Vote on decisions** — distributed counting that never loses a vote
- 👁 **See live cursors** — real-time presence of other collaborators

All of this works **offline**. Edits are queued locally and sync automatically on reconnect. There is **zero server-side logic** — the server is a dumb relay. All intelligence lives on the client.

---

## Why CRDTs?

Traditional apps use a **central database** as the source of truth. Two people edit the same thing → send it to the server → server decides who wins.

CRDTs flip this model:

```
Traditional:  Client → Server (decides) → Client
CRDTs:        Client (decides locally) → syncs with other clients → everyone converges
```

Every client can make changes independently, even offline. When clients sync, **the data automatically converges to the same state** — no conflicts, no coordination, no central authority.

This is how Google Docs handles 100 people typing in the same paragraph without a "save" button.

---

## 6 CRDTs — Each solving a different problem

This project isn't one CRDT. It's **six**, each used for a specific data shape:

| CRDT | Data Shape | Used For | How It Merges |
|---|---|---|---|
| **RGA** (Replicated Growable Array) | Ordered sequence | Shared document — character-level text editing | Each character has a unique ID + parent reference. Concurrent inserts at the same position are ordered by ID. Deletes use tombstones. |
| **OR-Set** (Observed-Remove Set) | Collection | Task list — adding and removing tasks | Every add is tagged. Remove only affects observed tags. Concurrent add + remove → add wins. |
| **LWW-Register** (Last-Writer-Wins) | Single value | Task metadata — title, assignee, priority | Stores value + timestamp. Higher timestamp wins. Simple but effective for fields edited by one person at a time. |
| **G-Counter** (Grow-only Counter) | Monotonic number | Vote counts — distributed increment | Each node maintains its own counter. Total = sum of all nodes. Two concurrent increments both count. |
| **PN-Counter** (Positive-Negative Counter) | Number with decrement | Net vote calculation | Two G-Counters: one for increments, one for decrements. Value = positive - negative. |
| **Vector Clock** | Logical time | Conflict detection | Tracks causal ordering. Detects when two edits happened concurrently (neither caused the other). |

### Why not just use RGA for everything?

Because different data shapes need different merge strategies:

- **Title of a task** → Single value. Last write wins. LWW-Register. *(Using RGA for a title would mean one operation per character — wasteful.)*
- **List of tasks** → Unordered collection. Add/remove semantics. OR-Set. *(RGA preserves order, but a task list isn't ordered text.)*
- **Vote count** → Number that only goes up. G-Counter. *(RGA has no concept of "counting".)*
- **Text in a document** → Ordered characters where both users' edits must survive. RGA. *(LWW-Register would discard one user's text entirely.)*

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                     CLIENT                            │
│                                                       │
│  ┌─── React UI ───────────────────────────────────┐  │
│  │ Document Editor │ Task Board │ Voting │ Cursors │  │
│  └────────────────────────────────────────────────┘  │
│                        │                              │
│  ┌─── useWorkspace Hook ──────────────────────────┐  │
│  │ Manages all CRDTs + WebSocket + offline queue   │  │
│  └────────────────────────────────────────────────┘  │
│            │                        │                 │
│  ┌─── CRDT Layer ──────┐  ┌─── Persistence ──────┐  │
│  │ RGA      OR-Set     │  │ IndexedDB            │  │
│  │ LWW-Reg  G-Counter  │  │ Operations stored    │  │
│  │ PN-Count VectorClock│  │ locally for offline   │  │
│  └─────────────────────┘  └──────────────────────┘  │
│            │                                          │
│  ┌─── WebSocket ──────────────────────────────────┐  │
│  │ Connect → Sync → Send/Receive operations       │  │
│  │ Auto-reconnect with exponential backoff         │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
                         │
                    WebSocket
                         │
┌──────────────────────────────────────────────────────┐
│                     SERVER                            │
│                                                       │
│  The server is DUMB. On purpose.                      │
│                                                       │
│  - Stores operations in memory                        │
│  - Broadcasts to other clients in the room            │
│  - Sends full operation history to new clients        │
│  - Does NOT understand CRDTs                          │
│  - Does NOT merge anything                            │
│  - Does NOT resolve conflicts                         │
│                                                       │
│  All intelligence lives on the client.                │
│  This is the entire point of CRDTs.                   │
└──────────────────────────────────────────────────────┘
```

---

## The hard part: RGA (Replicated Growable Array)

RGA is the most complex CRDT in this project. It enables **character-level collaborative text editing** — the same algorithm family used by Google Docs, Figma, and Notion.

### The problem with arrays

```
"HELLO"     positions: 0 1 2 3 4

Alice: insert 'X' at position 2 → "HEXLLO"
Bob:   insert 'Y' at position 2 → "HEYLLO"

They sync — position 2 means different things. Chaos.
```

### RGA's solution

**Every character gets a permanent unique ID.** Inserts reference a parent ID, not a position.

```
Alice: "insert 'X' after character {alice, 2}"    → always means after 'E'
Bob:   "insert 'Y' after character {alice, 2}"    → always means after 'E'

Same parent? Tiebreaker: compare IDs deterministically.
Both clients apply the same rule → both get the same result.
```

**Deletions use tombstones** — deleted characters are marked invisible but remain in memory, so future inserts can still find their parent.

```
Alice: insert 'X' after 'B'
Bob:   delete 'B'            (concurrent)

Without tombstones: Alice's insert has no parent. Broken.
With tombstones: 'B' is invisible but still exists. Alice's 'X' finds it. Works.
```

### Convergence proof

Three concurrent editors all type at the same position:

```
Alice types "od" after "Go"   →  "Good"
Bob types "lf" after "Go"     →  "Golf"
Charlie types "ne" after "Go"  →  "Gone"

All sync → all three get the EXACT same string.
All characters preserved. Zero data loss. Deterministic.
```

This is verified in the test suite (see `src/crdt/__tests__/rga.test.ts`).

---

## Offline-First

```
1. User is online → edits sync via WebSocket in real time
2. Connection drops → edits saved to IndexedDB + queued in memory
3. User keeps editing → everything works locally (CRDTs don't need a server)
4. Connection restores → queued operations sent → other clients receive them
5. Auto-reconnect with exponential backoff (1s, 2s, 4s, 8s... max 30s)
```

The app never shows a loading spinner or "connection lost" error. You keep working. It syncs when it can.

---

## Conflict Detection

While CRDTs **automatically merge** concurrent edits, sometimes you want to **show the user** that a conflict happened.

Vector Clocks detect when two operations are **concurrent** (neither happened before the other):

```
Alice sets task priority to "High"  at vector clock {alice: 5, bob: 3}
Bob sets task priority to "Low"     at vector clock {alice: 4, bob: 4}

Neither clock is strictly greater → these are concurrent edits.
LWW-Register picks the later timestamp → one wins.
Vector Clock detects the concurrency → UI shows "⚡ conflict detected".
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript |
| Styling | Inline styles (zero dependencies) |
| CRDT Layer | Custom implementation from scratch |
| Networking | Native WebSocket |
| Persistence | IndexedDB (via custom wrapper) |
| Server | Express + ws (WebSocket library) |
| Testing | Vitest (52 tests) |
| Deployment | Render |

**Zero CRDT libraries.** No Yjs, no Automerge, no third-party state management.

---

## Project Structure

```
src/
├── crdt/                        # CRDT implementations (pure TypeScript, no dependencies)
│   ├── rga.ts                   # Replicated Growable Array — collaborative text editing
│   ├── or-set.ts                # Observed-Remove Set — collection management
│   ├── lww-register.ts          # Last-Writer-Wins Register — single value storage
│   ├── g-counter.ts             # Grow-only Counter — distributed counting
│   ├── pn-counter.ts            # Positive-Negative Counter — increment + decrement
│   ├── vector-clock.ts          # Vector Clock — causal ordering + conflict detection
│   ├── document.ts              # Document CRDT — combines registers + clock
│   ├── index.ts                 # Barrel exports
│   └── __tests__/               # 52 tests covering all CRDTs
│       ├── rga.test.ts          # Concurrent edits, tombstones, 3-way merge, idempotency
│       ├── or-set.test.ts       # Add/remove, concurrent add+remove, merge
│       ├── lww-register.test.ts # Last-write-wins, timestamp ordering
│       ├── g-counter.test.ts    # Distributed increment, merge
│       ├── p-counter.test.ts    # Increment + decrement, merge
│       ├── vector-clock.test.ts # Causal ordering, concurrency detection
│       └── document.test.ts     # Multi-field document, conflict detection
│
├── frontend/                    # React UI
│   ├── App.tsx                  # Main workspace — document, tasks, voting, cursors
│   ├── Home.tsx                 # Landing page — room creation
│   ├── Room.tsx                 # Room wrapper
│   ├── useWorkspace.ts          # Hook — manages all CRDTs + WebSocket + persistence
│   ├── storage.ts               # IndexedDB wrapper for offline persistence
│   └── main.tsx                 # Entry point
│
├── server.ts                    # Development WebSocket server
└── prodServer.ts                # Production server (Express + WebSocket)
```

---

## Running Locally

```bash
# Install dependencies
npm install

# Terminal 1: Start the WebSocket server
npm run server

# Terminal 2: Start the frontend
npm run dev

# Open http://localhost:5173 in two browser tabs
# Create a room → collaborate in real time
```

### Production build

```bash
npm run build
npm start
# Open http://localhost:3000
```

### Tests

```bash
npm run test
```

```
 ✓ src/crdt/__tests__/rga.test.ts (12)
 ✓ src/crdt/__tests__/or-set.test.ts (7)
 ✓ src/crdt/__tests__/lww-register.test.ts (5)
 ✓ src/crdt/__tests__/vector-clock.test.ts (8)
 ✓ src/crdt/__tests__/g-counter.test.ts (6)
 ✓ src/crdt/__tests__/p-counter.test.ts (5)
 ✓ src/crdt/__tests__/document.test.ts (9)

 Test Files  7 passed (7)
      Tests  52 passed (52)
```

---

## Key Design Decisions

| Decision | Why |
|---|---|
| **6 CRDTs instead of 1** | Different data shapes need different merge strategies. Shows breadth of understanding. |
| **RGA from scratch** | Most CRDT demos use Yjs/Automerge. Building the core algorithm demonstrates understanding of the linked-list structure, tombstones, and convergence. |
| **Dumb server** | The server stores and relays. All merge logic is on the client. This is the architectural point of CRDTs — no server coordination needed. |
| **IndexedDB persistence** | Operations are saved locally. Refresh the page → data is still there. Server dies → you keep working. |
| **No external state management** | React hooks + CRDTs. The CRDT IS the state. No Redux, no Zustand, no MobX. |
| **Inline styles** | Zero CSS dependencies. The entire app is self-contained TypeScript. |

---

## What I Learned

- **CRDTs are a family, not a single algorithm.** Counters, registers, sets, and sequences each solve different consistency problems.
- **Tombstones are essential.** You can't delete nodes in a distributed linked list — other clients may reference them as parents.
- **Position-based editing breaks under concurrency.** RGA uses permanent character IDs + parent references instead of array indices.
- **The hard part isn't the UI.** It's making two clients converge to the same state when they've been editing independently.
- **Offline-first isn't a feature — it's an architecture.** When CRDTs handle merge, the server becomes optional.

---

## References

- [A comprehensive study of CRDTs](https://hal.inria.fr/inria-00555588/document) — Shapiro et al.
- [RGA: Replicated Growable Array](https://pages.lip6.fr/Marc.Shapiro/papers/rgasplit-group2016-11.pdf) — Roh et al.
- [CRDTs: The Hard Parts](https://www.youtube.com/watch?v=x7drE24geUw) — Martin Kleppmann
- [Yjs internals](https://github.com/yjs/yjs) — Production CRDT library (for comparison)
