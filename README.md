# CRDT Sync — Real-Time Collaborative Editor

A **local-first**, **real-time collaborative document editor** built from scratch using CRDTs (Conflict-free Replicated Data Types).

No server-side conflict resolution. No locking. No OT (Operational Transformation). Pure CRDTs — every client converges to the same state, guaranteed by math.

---

## What This Project Demonstrates

| Concept | Implementation |
|---------|---------------|
| **G-Counter** | Grow-only counter with per-node slots |
| **PN-Counter** | Increment + decrement using two G-Counters |
| **LWW-Register** | Last-writer-wins register with timestamp + node ID tie-breaking |
| **OR-Set** | Observed-Remove Set with unique tags and tombstones |
| **Vector Clock** | Causal ordering without wall clocks |
| **Document CRDT** | Multi-field document, each field is an independent LWW-Register |
| **WebSocket Sync** | Real-time operation broadcasting via relay server |
| **Offline Support** | Edit while disconnected, auto-sync on reconnect |
| **Conflict Detection** | Vector clock comparison detects concurrent edits |
| **Conflict UI** | Visual indicators showing who won, who lost, what was overwritten |

---

## Architecture

```
┌──────────────┐         ┌──────────────┐
│   Client A   │         │   Client B   │
│              │         │              │
│  ┌────────┐  │         │  ┌────────┐  │
│  │Document│  │         │  │Document│  │
│  │ CRDT   │  │         │  │ CRDT   │  │
│  └────────┘  │         │  └────────┘  │
│       │      │         │       │      │
│  ┌────────┐  │         │  ┌────────┐  │
│  │Offline │  │         │  │Offline │  │
│  │ Queue  │  │         │  │ Queue  │  │
│  └────────┘  │         │  └────────┘  │
│       │      │         │       │      │
└───────┼──────┘         └───────┼──────┘
        │                        │
        │    ┌──────────────┐    │
        └────│  WebSocket   │────┘
             │  Relay Server│
             │              │
             │  Operation   │
             │  Log (catch  │
             │  up new      │
             │  clients)    │
             └──────────────┘
```

### Data Flow

```
User types in input
       │
       ▼
  Debounce (500ms)
       │
       ▼
  Document.set(field, value)
       │
       ├── Vector Clock ticks
       ├── LWW-Register updated
       └── Operation created
              │
              ├── Connected? → Send to server → Broadcast to others
              └── Offline?   → Push to queue  → Flush on reconnect
                                                      │
                                                      ▼
                                              Others receive operation
                                                      │
                                                      ├── Document.apply(op)
                                                      ├── LWW merge (timestamp wins)
                                                      ├── Vector clock merge
                                                      └── Concurrent? → Show ⚠️ conflict
```

---

## CRDT Properties

Every CRDT in this project satisfies these mathematical properties:

| Property | Meaning | Why It Matters |
|----------|---------|----------------|
| **Commutative** | merge(A, B) = merge(B, A) | Order of receiving messages doesn't matter |
| **Associative** | merge(merge(A, B), C) = merge(A, merge(B, C)) | Grouping doesn't matter |
| **Idempotent** | merge(A, A) = A | Duplicate messages are harmless |

These three properties guarantee **eventual consistency** — all replicas converge to the same state without any coordination.

---

## Quick Start

### Prerequisites

- Node.js 20+
- npm

### Install

```bash
git clone https://github.com/adityak-21/crdt-sync.git
cd crdt-sync
npm install
```

### Run

**Terminal 1 — Start the sync server:**

```bash
npm run server
```

**Terminal 2 — Start the frontend:**

```bash
npm run dev
```

Open **two browser tabs** at `http://localhost:3000`.

### Test

```bash
npm run test
```

---

## How to Test Each Feature

| Feature | How to Test |
|---------|-------------|
| **Real-time sync** | Edit title in Tab 1 → see it appear in Tab 2 |
| **Independent fields** | Edit title in Tab 1, body in Tab 2 → no conflict, both merge |
| **LWW conflict** | Change status dropdown in both tabs quickly → one wins, both converge |
| **Conflict detection** | Edit same field in both tabs → see ⚠️ warning with winner/loser |
| **Offline editing** | Stop server (Ctrl+C) → keep editing → restart server → edits sync |
| **Auto-reconnect** | Stop server → watch "Offline" banner → restart → auto-reconnects |
| **New client catch-up** | Edit in Tab 1 → open Tab 3 → Tab 3 has all previous edits |

---

## Project Structure

```
crdt-sync/
├── src/
│   ├── crdt/                      # CRDT implementations
│   │   ├── g-counter.ts           # Grow-only counter
│   │   ├── pn-counter.ts          # Positive-Negative counter
│   │   ├── lww-register.ts        # Last-Writer-Wins register
│   │   ├── or-set.ts              # Observed-Remove set
│   │   ├── vector-clock.ts        # Vector clock for causal ordering
│   │   ├── document.ts            # Multi-field document CRDT
│   │   ├── index.ts               # Barrel exports
│   │   └── __tests__/             # Unit tests for all CRDTs
│   ├── frontend/                  # React UI
│   │   ├── index.html
│   │   ├── main.tsx               # Entry point
│   │   ├── App.tsx                # Editor UI + conflict indicators
│   │   └── useDocument.ts         # Hook: CRDT + WebSocket + offline queue
│   ├── server.ts                  # WebSocket relay server
│   ├── client.ts                  # CLI client (for testing)
│   └── demo.ts                    # CLI demo (two clients syncing)
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## Known Limitations & Future Work

### Field-Level Granularity

This project uses **field-level CRDTs** — each field (title, body, status) is an independent LWW-Register. If two users edit different fields simultaneously, there's no conflict.

However, if two users edit the **same field** (e.g., different paragraphs within the body), one user's entire value wins via LWW. There's no character-level merging.

**Why this tradeoff:** The goal was to demonstrate CRDT fundamentals, vector clocks, and conflict resolution architecture from scratch — not to rebuild Google Docs. Character-level editing requires a **Sequence CRDT** (YATA, RGA, or Fugue algorithm), which libraries like [Yjs](https://github.com/yjs/yjs) and [Automerge](https://github.com/automerge/automerge) implement.

### Possible Extensions

- **Sequence CRDT** for character-level text editing
- **Persistence** — save CRDT state to IndexedDB for true offline-first
- **Awareness** — show other users' cursors and selections
- **History** — undo/redo with causal ordering
- **Authentication** — per-user identity instead of random client IDs

---

## Tech Stack

| Technology | Purpose |
|-----------|---------|
| TypeScript | Type-safe CRDT implementations |
| React | Frontend UI |
| WebSocket (ws) | Real-time sync |
| Vite | Dev server + bundler |
| Vitest | Unit testing |

---

## References

- [A Comprehensive Study of CRDTs](https://hal.inria.fr/inria-00555588/document) — Shapiro et al.
- [CRDTs: The Hard Parts](https://www.youtube.com/watch?v=x7drE24geUw) — Martin Kleppmann
- [Yjs](https://github.com/yjs/yjs) — Production Sequence CRDT
- [Automerge](https://github.com/automerge/automerge) — JSON-like CRDT library