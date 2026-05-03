import React, { useRef, useCallback, useEffect, useState } from "react";
import { useWorkspace, CursorInfo } from "./useWorkspace";
import { ConflictInfo } from "../crdt";

// ─── Task parsing ───

interface Task {
  id: string;
  title: string;
  assignee: string;
  priority: string;
  done: boolean;
}

function parseTasks(doc: Record<string, unknown>): Task[] {
  const map = new Map<string, Partial<Task>>();
  for (const [key, value] of Object.entries(doc)) {
    const m = key.match(/^task-([^-]+)-(.+)$/);
    if (!m) continue;
    const [, id, field] = m;
    if (field === "deleted" && value === true) { map.delete(id); continue; }
    if (!map.has(id)) map.set(id, { id });
    const t = map.get(id)!;
    if (field === "title") t.title = value as string;
    if (field === "assignee") t.assignee = value as string;
    if (field === "priority") t.priority = value as string;
    if (field === "done") t.done = value as boolean;
  }
  return Array.from(map.values()).map((t) => ({
    id: t.id!, title: t.title ?? "", assignee: t.assignee ?? "",
    priority: t.priority ?? "medium", done: t.done ?? false,
  }));
}

export function App({ roomId }: { roomId: string }) {
  const w = useWorkspace(roomId);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastCursorSend = useRef(0);
  const [newTask, setNewTask] = useState("");
  const [activeTab, setActiveTab] = useState<"doc" | "tasks" | "vote">("doc");

  const tasks = parseTasks(w.doc);
  const upVotes = (w.doc["votes-up"] as number) || 0;
  const downVotes = (w.doc["votes-down"] as number) || 0;
  const hasVotedUp = w.doc[`vote-${w.nodeId}-up`] === true;
  const hasVotedDown = w.doc[`vote-${w.nodeId}-down`] === true;
  const docFieldCount = Object.keys(w.doc).length;

  // ─── RGA beforeinput ───
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const handler = (e: InputEvent) => {
      const s = ta.selectionStart, end = ta.selectionEnd;
      if (e.inputType === "insertText" || e.inputType === "insertFromPaste" || e.inputType === "insertLineBreak") {
        e.preventDefault();
        if (s !== end) for (let i = end - 1; i >= s; i--) w.deleteChar(i);
        const chars = e.inputType === "insertLineBreak" ? "\n" : e.data || "";
        for (let i = 0; i < chars.length; i++) w.insertChar(s + i, chars[i]);
        const np = s + chars.length;
        requestAnimationFrame(() => { ta.selectionStart = np; ta.selectionEnd = np; });
      }
      if (e.inputType === "deleteContentBackward") {
        e.preventDefault();
        if (s !== end) {
          for (let i = end - 1; i >= s; i--) w.deleteChar(i);
          requestAnimationFrame(() => { ta.selectionStart = s; ta.selectionEnd = s; });
        } else if (s > 0) {
          w.deleteChar(s - 1);
          requestAnimationFrame(() => { ta.selectionStart = s - 1; ta.selectionEnd = s - 1; });
        }
      }
      if (e.inputType === "deleteContentForward") {
        e.preventDefault();
        if (s !== end) {
          for (let i = end - 1; i >= s; i--) w.deleteChar(i);
          requestAnimationFrame(() => { ta.selectionStart = s; ta.selectionEnd = s; });
        } else if (s < w.text.length) w.deleteChar(s);
      }
    };
    ta.addEventListener("beforeinput", handler);
    return () => ta.removeEventListener("beforeinput", handler);
  }, [w.text, w.insertChar, w.deleteChar, w.loading, activeTab]);

  // ─── Cursor ───
  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const now = Date.now();
    if (now - lastCursorSend.current < 50) return;
    lastCursorSend.current = now;
    w.sendCursor(e.clientX, e.clientY);
  }, [w.sendCursor]);

  // ─── Task actions ───
  const addTask = useCallback(() => {
    if (!newTask.trim()) return;
    const id = Math.random().toString(36).slice(2, 8);
    w.editField(`task-${id}-title`, newTask.trim());
    w.editField(`task-${id}-assignee`, w.nodeId);
    w.editField(`task-${id}-priority`, "medium");
    w.editField(`task-${id}-done`, false);
    setNewTask("");
  }, [newTask, w.editField, w.nodeId]);

  const vote = useCallback((dir: "up" | "down") => {
    const other = dir === "up" ? "down" : "up";
    if (w.doc[`vote-${w.nodeId}-${dir}`] === true) return;
    if (w.doc[`vote-${w.nodeId}-${other}`] === true) {
      w.editField(`vote-${w.nodeId}-${other}`, false);
      w.decrementField(`votes-${other}`);
    }
    w.editField(`vote-${w.nodeId}-${dir}`, true);
    w.incrementField(`votes-${dir}`);
  }, [w.editField, w.incrementField, w.decrementField, w.nodeId, w.doc]);

  if (w.loading) {
    return (
      <div style={{
        height: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
        color: "#94a3b8", fontFamily: "system-ui, -apple-system, sans-serif", fontSize: 15,
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: 40, height: 40, border: "3px solid #334155", borderTopColor: "#6366f1",
            borderRadius: "50%", margin: "0 auto 16px", animation: "spin 0.8s linear infinite",
          }} />
          Loading workspace...
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  return (
    <div style={S.root} onMouseMove={onMouseMove}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
        * { box-sizing: border-box; }
        textarea:focus, input:focus, select:focus { outline: none; box-shadow: 0 0 0 2px rgba(99,102,241,0.3); }
        button:hover { filter: brightness(0.95); }
        button:active { transform: scale(0.97); }
        ::selection { background: rgba(99,102,241,0.2); }
      `}</style>

      {/* ═══ HEADER ═══ */}
      <header style={S.header}>
        <div style={S.hLeft}>
          <a href="/" style={S.hBack}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </a>
          <div style={S.hBrand}>
            <span style={S.hLogo}>⚡</span>
            <span style={S.hTitle}>CRDT Workspace</span>
          </div>
          <div style={S.hRoom}>
            <span style={S.hRoomDot} />
            {roomId}
          </div>
        </div>
        <div style={S.hRight}>
          <div style={S.hUsers}>
            {w.onlineUsers.map((u, i) => (
              <div key={u} style={{
                ...S.hAvatar,
                backgroundColor: u === w.nodeId ? w.userColor : `hsl(${i * 72}, 50%, 60%)`,
                zIndex: w.onlineUsers.length - i,
                border: u === w.nodeId ? "2px solid rgba(255,255,255,0.9)" : "2px solid rgba(255,255,255,0.2)",
              }} title={u === w.nodeId ? `${u} (you)` : u}>
                {u.slice(-2).toUpperCase()}
              </div>
            ))}
          </div>
          <div style={{
            ...S.hStatus,
            background: w.connected ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
            color: w.connected ? "#4ade80" : "#f87171",
          }}>
            <span style={{ ...S.hStatusDot, background: w.connected ? "#4ade80" : "#f87171" }} />
            {w.connected ? "Connected" : "Offline"}
          </div>
        </div>
      </header>

      {/* ═══ BANNERS ═══ */}
      {!w.connected && (
        <div style={S.banner}>
          <span>📡 Working offline — changes sync automatically on reconnect</span>
          {w.offlineQueueSize > 0 && <span style={S.bannerPill}>{w.offlineQueueSize} queued</span>}
        </div>
      )}
      {w.conflicts.length > 0 && (
        <div style={S.conflictBar}>
          ⚡ {w.conflicts.length} conflict{w.conflicts.length > 1 ? "s" : ""} — 
          {w.conflicts.map(c => (
            <span key={c.field} style={S.conflictItem}>
              <strong>{c.field.replace(/^task-[^-]+-/, "")}</strong>
              <button style={S.conflictX} onClick={() => w.dismissConflict(c.field)}>✕</button>
            </span>
          ))}
        </div>
      )}

      {/* ═══ BODY ═══ */}
      <div style={S.body}>
        {/* LEFT */}
        <div style={S.left}>
          {/* Tab bar */}
          <div style={S.tabBar}>
            {(["doc", "tasks", "vote"] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{
                ...S.tab,
                ...(activeTab === tab ? S.tabActive : {}),
              }}>
                {tab === "doc" ? "📝 Document" : tab === "tasks" ? "✅ Tasks" : "🗳 Vote"}
                {tab === "tasks" && tasks.length > 0 && (
                  <span style={S.tabBadge}>{tasks.length}</span>
                )}
              </button>
            ))}
          </div>

          {/* Content area */}
          <div style={S.content}>
            {/* ── DOCUMENT TAB ── */}
            {activeTab === "doc" && (
              <div style={{ animation: "fadeIn 0.2s ease" }}>
                <div style={S.sectionHeader}>
                  <div>
                    <h2 style={S.sectionTitle}>Shared Document</h2>
                    <p style={S.sectionSub}>Every keystroke is an RGA operation. Two people type simultaneously — both edits merge.</p>
                  </div>
                  <span style={S.crdtPill}>RGA</span>
                </div>
                <div style={S.editorWrap}>
                  <textarea
                    ref={textareaRef}
                    style={S.editor}
                    value={w.text}
                    onChange={() => {}}
                    placeholder={"Start typing here...\n\nOpen this URL in another browser tab and type in both.\nWatch character-level merge in real time — like Google Docs.\n\nEvery character has a unique ID. Concurrent edits never overwrite each other."}
                    spellCheck={false}
                  />
                  <div style={S.editorBar}>
                    <span>{w.rgaStats.chars} characters</span>
                    <span>·</span>
                    <span>{w.rgaStats.tombstones} tombstones</span>
                    <span>·</span>
                    <span>{w.rgaStats.ops} operations</span>
                  </div>
                </div>
              </div>
            )}

            {/* ── TASKS TAB ── */}
            {activeTab === "tasks" && (
              <div style={{ animation: "fadeIn 0.2s ease" }}>
                <div style={S.sectionHeader}>
                  <div>
                    <h2 style={S.sectionTitle}>Task Board</h2>
                    <p style={S.sectionSub}>Add/remove tasks (OR-Set). Edit metadata (LWW-Register). Concurrent edits detected (Vector Clock).</p>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <span style={S.crdtPill}>OR-Set</span>
                    <span style={{ ...S.crdtPill, background: "#fdf4ff", color: "#a855f7" }}>LWW-Register</span>
                  </div>
                </div>

                {/* Add task */}
                <div style={S.taskAdd}>
                  <input
                    style={S.taskAddInput}
                    value={newTask}
                    onChange={e => setNewTask(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && addTask()}
                    placeholder="What needs to be done?"
                  />
                  <button style={S.taskAddBtn} onClick={addTask}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
                    Add Task
                  </button>
                </div>

                {tasks.length === 0 ? (
                  <div style={S.emptyState}>
                    <span style={{ fontSize: 40 }}>📋</span>
                    <p style={{ margin: "12px 0 0", color: "#94a3b8" }}>No tasks yet. Add one above!</p>
                  </div>
                ) : (
                  <div style={S.taskList}>
                    {tasks.map(task => {
                      const prio = task.priority === "high" ? { bg: "#fef2f2", border: "#fecaca", dot: "#ef4444", label: "High" }
                        : task.priority === "low" ? { bg: "#f0fdf4", border: "#bbf7d0", dot: "#22c55e", label: "Low" }
                        : { bg: "#fffbeb", border: "#fde68a", dot: "#f59e0b", label: "Medium" };
                      const hasConflict = w.conflicts.some(c => c.field.startsWith(`task-${task.id}`));

                      return (
                        <div key={task.id} style={{
                          ...S.task,
                          opacity: task.done ? 0.5 : 1,
                          borderLeftColor: prio.dot,
                          ...(hasConflict ? { boxShadow: `inset 0 0 0 1px #f59e0b` } : {}),
                        }}>
                          <button style={S.taskCheck} onClick={() => w.editField(`task-${task.id}-done`, !task.done)}>
                            {task.done ? (
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="#6366f1" stroke="white" strokeWidth="2">
                                <rect x="3" y="3" width="18" height="18" rx="4"/>
                                <path d="M9 12l2 2 4-4"/>
                              </svg>
                            ) : (
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="2">
                                <rect x="3" y="3" width="18" height="18" rx="4"/>
                              </svg>
                            )}
                          </button>
                          <div style={S.taskBody}>
                            <span style={{
                              ...S.taskTitle,
                              textDecoration: task.done ? "line-through" : "none",
                              color: task.done ? "#94a3b8" : "#1e293b",
                            }}>{task.title}</span>
                            <div style={S.taskMeta}>
                              <span style={{
                                ...S.prioBadge,
                                backgroundColor: prio.bg,
                                color: prio.dot,
                                borderColor: prio.border,
                              }}>
                                <span style={{ ...S.prioDot, backgroundColor: prio.dot }} />
                                {prio.label}
                              </span>
                              <select style={S.taskSelect} value={task.priority}
                                onChange={e => w.editField(`task-${task.id}-priority`, e.target.value)}>
                                <option value="high">🔴 High</option>
                                <option value="medium">🟡 Medium</option>
                                <option value="low">🟢 Low</option>
                              </select>
                              <select style={S.taskSelect} value={task.assignee}
                                onChange={e => w.editField(`task-${task.id}-assignee`, e.target.value)}>
                                {w.onlineUsers.map(u => <option key={u} value={u}>{u}</option>)}
                                {!w.onlineUsers.includes(task.assignee) && <option value={task.assignee}>{task.assignee}</option>}
                              </select>
                              {hasConflict && <span style={S.conflictMini}>⚡ conflict</span>}
                            </div>
                          </div>
                          <button style={S.taskDel} onClick={() => w.editField(`task-${task.id}-deleted`, true)}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                              <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                            </svg>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── VOTE TAB ── */}
            {activeTab === "vote" && (
              <div style={{ animation: "fadeIn 0.2s ease" }}>
                <div style={S.sectionHeader}>
                  <div>
                    <h2 style={S.sectionTitle}>Team Vote</h2>
                    <p style={S.sectionSub}>Distributed counting — two people vote simultaneously, both votes count. No double-counting.</p>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <span style={{ ...S.crdtPill, background: "#ecfdf5", color: "#10b981" }}>G-Counter</span>
                    <span style={{ ...S.crdtPill, background: "#fef2f2", color: "#ef4444" }}>PN-Counter</span>
                  </div>
                </div>

                <div style={S.voteCard}>
                  <input
                    style={S.voteQ}
                    value={(w.doc["vote-question"] as string) || ""}
                    onChange={e => w.editField("vote-question", e.target.value)}
                    placeholder="Type a question for the team to vote on..."
                  />

                  <div style={S.voteButtons}>
                    <button style={{
                      ...S.voteBtn,
                      background: hasVotedUp ? "#dcfce7" : "linear-gradient(135deg, #22c55e, #16a34a)",
                      color: hasVotedUp ? "#16a34a" : "white",
                      cursor: hasVotedUp ? "default" : "pointer",
                    }} onClick={() => vote("up")} disabled={hasVotedUp}>
                      <span style={{ fontSize: 28 }}>👍</span>
                      <span style={{ fontSize: 32, fontWeight: 800 }}>{upVotes}</span>
                      <span style={{ fontSize: 12, opacity: 0.8 }}>{hasVotedUp ? "Voted" : "Vote Yes"}</span>
                    </button>
                    <button style={{
                      ...S.voteBtn,
                      background: hasVotedDown ? "#fee2e2" : "linear-gradient(135deg, #ef4444, #dc2626)",
                      color: hasVotedDown ? "#dc2626" : "white",
                      cursor: hasVotedDown ? "default" : "pointer",
                    }} onClick={() => vote("down")} disabled={hasVotedDown}>
                      <span style={{ fontSize: 28 }}>👎</span>
                      <span style={{ fontSize: 32, fontWeight: 800 }}>{downVotes}</span>
                      <span style={{ fontSize: 12, opacity: 0.8 }}>{hasVotedDown ? "Voted" : "Vote No"}</span>
                    </button>
                  </div>

                  <div style={S.voteResult}>
                    <div style={S.voteBar}>
                      <div style={{
                        ...S.voteBarFill,
                        width: upVotes + downVotes > 0 ? `${(upVotes / (upVotes + downVotes)) * 100}%` : "50%",
                        background: "linear-gradient(90deg, #22c55e, #4ade80)",
                      }} />
                    </div>
                    <div style={S.voteNet}>
                      Net: <strong style={{ fontSize: 20 }}>{upVotes - downVotes > 0 ? "+" : ""}{upVotes - downVotes}</strong>
                      <span style={{ marginLeft: 8, color: "#94a3b8" }}>
                        {upVotes - downVotes > 0 ? "✅ Team says yes" : upVotes - downVotes < 0 ? "❌ Team says no" : "⚖️ Tied"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT SIDEBAR */}
        <div style={S.right}>
          {/* Stats */}
          <div style={S.sideCard}>
            <h3 style={S.sideTitle}>📊 Live CRDT Stats</h3>
            <div style={S.statsGrid}>
              {[
                { v: w.rgaStats.chars, l: "RGA Chars", icon: "📝", bg: "#eef2ff" },
                { v: w.rgaStats.tombstones, l: "Tombstones", icon: "👻", bg: "#fefce8" },
                { v: docFieldCount, l: "LWW Fields", icon: "📦", bg: "#f0fdf4" },
                { v: w.rgaStats.ops, l: "RGA Ops", icon: "⚡", bg: "#fdf4ff" },
                { v: w.conflicts.length, l: "Conflicts", icon: "🔥", bg: "#fff1f2" },
                { v: w.onlineUsers.length, l: "Online", icon: "👥", bg: "#f0f9ff" },
              ].map(s => (
                <div key={s.l} style={S.statItem}>
                  <span style={{ ...S.statIcon, backgroundColor: s.bg }}>{s.icon}</span>
                  <div style={S.statValue}>{s.v}</div>
                  <div style={S.statLabel}>{s.l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Users */}
          <div style={S.sideCard}>
            <h3 style={S.sideTitle}>👥 Collaborators</h3>
            {w.onlineUsers.map((u, i) => (
              <div key={u} style={S.userRow}>
                <div style={{
                  ...S.userAvatar,
                  backgroundColor: u === w.nodeId ? w.userColor : `hsl(${i * 72}, 50%, 60%)`,
                }}>
                  {u.slice(-2).toUpperCase()}
                </div>
                <div>
                  <div style={S.userName}>{u} {u === w.nodeId && <span style={S.youBadge}>you</span>}</div>
                  <div style={S.userStatus}>
                    <span style={{ ...S.userStatusDot, background: "#22c55e" }} />
                    Active now
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* CRDT Map */}
          <div style={S.sideCard}>
            <h3 style={S.sideTitle}>🧠 CRDT Architecture</h3>
            {[
              { feature: "Text editing", crdt: "RGA", color: "#6366f1", bg: "#eef2ff" },
              { feature: "Task add/remove", crdt: "OR-Set", color: "#0891b2", bg: "#ecfeff" },
              { feature: "Task metadata", crdt: "LWW-Register", color: "#a855f7", bg: "#fdf4ff" },
              { feature: "Vote counting", crdt: "G-Counter", color: "#16a34a", bg: "#f0fdf4" },
              { feature: "Net votes", crdt: "PN-Counter", color: "#e11d48", bg: "#fff1f2" },
              { feature: "Conflict detect", crdt: "Vector Clock", color: "#d97706", bg: "#fffbeb" },
            ].map(r => (
              <div key={r.feature} style={S.crdtRow}>
                <span style={S.crdtRowLabel}>{r.feature}</span>
                <span style={{ ...S.crdtRowBadge, color: r.color, backgroundColor: r.bg }}>{r.crdt}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ FOOTER ═══ */}
      <footer style={S.footer}>
        🧪 <strong>Test:</strong> Open <code style={S.code}>{window.location.href}</code> in another tab. Type, add tasks, vote — watch everything sync in real time.
      </footer>

      {/* ═══ LIVE CURSORS ═══ */}
      {Array.from(w.cursors.values()).map((c: CursorInfo) => (
        <div key={c.nodeId} style={{
          position: "fixed", left: c.x, top: c.y, pointerEvents: "none", zIndex: 99999,
          transition: "left 0.08s ease-out, top 0.08s ease-out",
        }}>
          <svg width="16" height="20" viewBox="0 0 16 20" fill="none" style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.2))" }}>
            <path d="M0 0L16 12L8 12L4 20L0 0Z" fill={c.color} />
          </svg>
          <span style={{
            display: "inline-block", marginLeft: 10, marginTop: -4,
            padding: "3px 8px", borderRadius: 6, fontSize: 11, color: "white",
            fontWeight: 600, backgroundColor: c.color, whiteSpace: "nowrap",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
          }}>{c.nodeId}</span>
        </div>
      ))}
    </div>
  );
}

// ─── STYLES ───

const S: Record<string, React.CSSProperties> = {
  root: {
    minHeight: "100vh", display: "flex", flexDirection: "column",
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    backgroundColor: "#f8fafc", color: "#1e293b",
  },

  // Header
  header: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "0 24px", height: 56,
    background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  hLeft: { display: "flex", alignItems: "center", gap: 14 },
  hBack: {
    display: "flex", alignItems: "center", justifyContent: "center",
    width: 34, height: 34, borderRadius: 8, color: "#94a3b8",
    textDecoration: "none", backgroundColor: "rgba(255,255,255,0.06)",
    transition: "background 0.15s",
  },
  hBrand: { display: "flex", alignItems: "center", gap: 6 },
  hLogo: { fontSize: 20 },
  hTitle: { fontSize: 16, fontWeight: 700, color: "white", letterSpacing: -0.3 },
  hRoom: {
    display: "flex", alignItems: "center", gap: 6,
    fontSize: 12, fontFamily: "monospace", padding: "4px 10px",
    borderRadius: 6, backgroundColor: "rgba(255,255,255,0.06)", color: "#64748b",
  },
  hRoomDot: { width: 6, height: 6, borderRadius: "50%", backgroundColor: "#6366f1" },
  hRight: { display: "flex", alignItems: "center", gap: 14 },
  hUsers: { display: "flex" },
  hAvatar: {
    width: 30, height: 30, borderRadius: "50%", display: "flex",
    alignItems: "center", justifyContent: "center", fontSize: 10,
    fontWeight: 700, color: "white", marginLeft: -6,
    transition: "transform 0.15s",
  },
  hStatus: {
    display: "flex", alignItems: "center", gap: 6,
    padding: "4px 12px", borderRadius: 999, fontSize: 12, fontWeight: 600,
  },
  hStatusDot: { width: 7, height: 7, borderRadius: "50%", animation: "pulse 2s ease infinite" },

  // Banners
  banner: {
    display: "flex", justifyContent: "center", alignItems: "center", gap: 10,
    padding: "8px 24px", backgroundColor: "#fef3c7", color: "#92400e",
    fontSize: 13, fontWeight: 500,
  },
  bannerPill: {
    backgroundColor: "#f59e0b", color: "white", padding: "1px 10px",
    borderRadius: 999, fontSize: 11, fontWeight: 700,
  },
  conflictBar: {
    padding: "8px 24px", background: "linear-gradient(90deg, #fff7ed, #fffbeb)",
    color: "#9a3412", fontSize: 13, textAlign: "center",
  },
  conflictItem: { marginLeft: 6 },
  conflictX: {
    background: "none", border: "none", cursor: "pointer",
    color: "#9a3412", fontSize: 13, marginLeft: 4, fontWeight: 700,
  },

  // Body
  body: {
    flex: 1, display: "flex", gap: 20, padding: 20,
    maxWidth: 1400, margin: "0 auto", width: "100%",
  },
  left: { flex: 1, display: "flex", flexDirection: "column", minWidth: 0 },
  right: { width: 300, display: "flex", flexDirection: "column", gap: 16, flexShrink: 0 },

  // Tabs
  tabBar: {
    display: "flex", gap: 4, padding: 4, marginBottom: 16,
    backgroundColor: "#e2e8f0", borderRadius: 12,
  },
  tab: {
    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
    padding: "10px 16px", border: "none", borderRadius: 10,
    fontSize: 14, fontWeight: 600, cursor: "pointer",
    backgroundColor: "transparent", color: "#64748b",
    transition: "all 0.15s",
  },
  tabActive: {
    backgroundColor: "white", color: "#0f172a",
    boxShadow: "0 1px 3px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)",
  },
  tabBadge: {
    backgroundColor: "#6366f1", color: "white", fontSize: 10,
    fontWeight: 700, padding: "1px 6px", borderRadius: 999, minWidth: 18, textAlign: "center",
  },

  // Content
  content: {
    flex: 1, backgroundColor: "white", borderRadius: 16,
    border: "1px solid #e2e8f0", overflow: "hidden",
    boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.02)",
  },
  sectionHeader: {
    display: "flex", justifyContent: "space-between", alignItems: "flex-start",
    padding: "20px 24px 16px",
    borderBottom: "1px solid #f1f5f9",
  },
  sectionTitle: { fontSize: 18, fontWeight: 700, margin: 0, color: "#0f172a" },
  sectionSub: { fontSize: 13, color: "#94a3b8", margin: "4px 0 0", lineHeight: 1.5 },
  crdtPill: {
    fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 6,
    backgroundColor: "#eef2ff", color: "#6366f1", whiteSpace: "nowrap",
  },

  // Editor
  editorWrap: { display: "flex", flexDirection: "column" },
  editor: {
    width: "100%", minHeight: 300, padding: "24px 24px", fontSize: 16,
    lineHeight: 1.8, border: "none", outline: "none", resize: "none",
    fontFamily: '"Georgia", "Times New Roman", serif', color: "#1e293b",
    backgroundColor: "white",
  },
  editorBar: {
    display: "flex", gap: 8, padding: "10px 24px",
    borderTop: "1px solid #f1f5f9", backgroundColor: "#fafbfc",
    fontSize: 12, color: "#94a3b8",
  },

  // Tasks
  taskAdd: {
    display: "flex", gap: 10, padding: "16px 24px",
    borderBottom: "1px solid #f1f5f9", backgroundColor: "#fafbfc",
  },
  taskAddInput: {
    flex: 1, padding: "10px 14px", fontSize: 14,
    border: "1px solid #e2e8f0", borderRadius: 10,
    backgroundColor: "white", transition: "border-color 0.15s",
  },
  taskAddBtn: {
    display: "flex", alignItems: "center", gap: 6,
    padding: "10px 18px", fontSize: 13, fontWeight: 600,
    background: "linear-gradient(135deg, #6366f1, #4f46e5)",
    color: "white", border: "none", borderRadius: 10, cursor: "pointer",
    whiteSpace: "nowrap", boxShadow: "0 1px 3px rgba(99,102,241,0.3)",
  },
  emptyState: { textAlign: "center", padding: "48px 24px" },
  taskList: { padding: "8px 0" },
  task: {
    display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 24px",
    borderBottom: "1px solid #f8fafc", borderLeft: "3px solid transparent",
    transition: "background 0.1s, opacity 0.2s",
  },
  taskCheck: {
    background: "none", border: "none", cursor: "pointer", padding: 0, marginTop: 1,
    display: "flex", alignItems: "center",
  },
  taskBody: { flex: 1, minWidth: 0 },
  taskTitle: { fontSize: 14, fontWeight: 500, lineHeight: 1.5 },
  taskMeta: { display: "flex", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" },
  prioBadge: {
    display: "flex", alignItems: "center", gap: 4,
    fontSize: 11, fontWeight: 600, padding: "2px 8px",
    borderRadius: 6, border: "1px solid",
  },
  prioDot: { width: 6, height: 6, borderRadius: "50%" },
  taskSelect: {
    fontSize: 12, padding: "3px 6px", border: "1px solid #e2e8f0",
    borderRadius: 6, backgroundColor: "#f8fafc", color: "#475569", cursor: "pointer",
  },
  conflictMini: {
    fontSize: 10, color: "#d97706", backgroundColor: "#fef3c7",
    padding: "1px 6px", borderRadius: 4, fontWeight: 600,
  },
  taskDel: {
    background: "none", border: "none", cursor: "pointer", color: "#cbd5e1",
    padding: 4, borderRadius: 6, transition: "color 0.15s", marginTop: 2,
  },

  // Vote
  voteCard: { padding: "24px" },
  voteQ: {
    width: "100%", padding: "12px 16px", fontSize: 16, fontWeight: 500,
    border: "1px solid #e2e8f0", borderRadius: 12, textAlign: "center",
    backgroundColor: "#fafbfc",
  },
  voteButtons: {
    display: "flex", gap: 16, justifyContent: "center", marginTop: 24,
  },
  voteBtn: {
    display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
    padding: "20px 36px", borderRadius: 16, border: "none",
    fontSize: 16, fontWeight: 700, transition: "transform 0.1s, box-shadow 0.15s",
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
    minWidth: 130,
  },
  voteResult: { marginTop: 24 },
  voteBar: {
    height: 8, borderRadius: 999, backgroundColor: "#fee2e2", overflow: "hidden",
  },
  voteBarFill: {
    height: "100%", borderRadius: 999, transition: "width 0.3s ease",
  },
  voteNet: {
    textAlign: "center", marginTop: 12, fontSize: 14, color: "#475569",
  },

  // Sidebar
  sideCard: {
    backgroundColor: "white", borderRadius: 14, border: "1px solid #e2e8f0",
    overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  },
  sideTitle: {
    fontSize: 13, fontWeight: 700, margin: 0, padding: "14px 16px 10px",
    color: "#0f172a", borderBottom: "1px solid #f1f5f9",
  },
  statsGrid: {
    display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1,
    backgroundColor: "#f1f5f9", borderTop: "1px solid #f1f5f9",
  },
  statItem: {
    display: "flex", flexDirection: "column", alignItems: "center",
    padding: "14px 8px", backgroundColor: "white", gap: 4,
  },
  statIcon: {
    width: 28, height: 28, borderRadius: 8, display: "flex",
    alignItems: "center", justifyContent: "center", fontSize: 13,
  },
  statValue: { fontSize: 18, fontWeight: 700, color: "#0f172a" },
  statLabel: { fontSize: 10, color: "#94a3b8", textAlign: "center" },
  userRow: { display: "flex", alignItems: "center", gap: 10, padding: "10px 16px" },
  userAvatar: {
    width: 32, height: 32, borderRadius: "50%", display: "flex",
    alignItems: "center", justifyContent: "center", fontSize: 11,
    fontWeight: 700, color: "white", flexShrink: 0,
  },
  userName: { fontSize: 13, fontWeight: 600, color: "#1e293b" },
  youBadge: {
    fontSize: 10, color: "#6366f1", backgroundColor: "#eef2ff",
    padding: "1px 6px", borderRadius: 4, marginLeft: 4, fontWeight: 600,
  },
  userStatus: { display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#94a3b8", marginTop: 1 },
  userStatusDot: { width: 6, height: 6, borderRadius: "50%" },
  crdtRow: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "8px 16px", borderBottom: "1px solid #f8fafc",
  },
  crdtRowLabel: { fontSize: 12, color: "#475569" },
  crdtRowBadge: {
    fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 6,
  },

  // Footer
  footer: {
    padding: "12px 24px", backgroundColor: "white",
    borderTop: "1px solid #e2e8f0", fontSize: 13,
    color: "#64748b", textAlign: "center",
  },
  code: {
    backgroundColor: "#f1f5f9", padding: "2px 8px", borderRadius: 6,
    fontSize: 12, fontFamily: "monospace", color: "#475569",
  },
};