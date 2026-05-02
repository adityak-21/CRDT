import React, { useRef } from "react";
import { useDocument } from "./useDocument";

function useDebouncedCallback(callback: (field: string, value: string) => void, delay: number) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  return (field: string, value: string) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      callback(field, value);
    }, delay);
  };
}

export function App() {
  const { doc, edit, connected, nodeId } = useDocument();

  const debouncedEdit = useDebouncedCallback(edit, 500);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>📝 CRDT Collaborative Editor</h1>
        <div style={styles.status}>
          <span
            style={{
              ...styles.dot,
              backgroundColor: connected ? "#4ade80" : "#f87171",
            }}
          />
          {connected ? "Connected" : "Disconnected"} as{" "}
          <strong>{nodeId}</strong>
        </div>
      </div>

      <div style={styles.fields}>
        <div style={styles.fieldGroup}>
          <label style={styles.label}>Title</label>
          <input
            style={styles.input}
            placeholder="Document title..."

            defaultValue={(doc.title as string) ?? ""}
            onChange={(e) => {
              debouncedEdit("title", e.target.value);
            }}
          />
        </div>

        {/* Status field */}
        <div style={styles.fieldGroup}>
          <label style={styles.label}>Status</label>
          <select
            style={styles.select}
            value={(doc.status as string) ?? "draft"}
            onChange={(e) => {
              edit("status", e.target.value);
            }}
          >
            <option value="draft">📝 Draft</option>
            <option value="review">👀 In Review</option>
            <option value="final">✅ Final</option>
          </select>
        </div>

        {/* Body field */}
        <div style={styles.fieldGroup}>
          <label style={styles.label}>Body</label>
          <textarea
            style={styles.textarea}
            placeholder="Start writing..."
            defaultValue={(doc.body as string) ?? ""}
            onChange={(e) => {
              debouncedEdit("body", e.target.value);
            }}
            rows={10}
          />
        </div>

        <div style={styles.fieldGroup}>
          <label style={styles.label}>Tags (comma separated)</label>
          <input
            style={styles.input}
            placeholder="e.g. work, urgent, meeting"
            defaultValue={(doc.tags as string) ?? ""}
            onChange={(e) => {
              debouncedEdit("tags", e.target.value);
            }}
          />
        </div>
      </div>

      <div style={styles.stateViewer}>
        <h3 style={styles.stateTitle}>🔍 Live CRDT State</h3>
        <pre style={styles.stateContent}>
          {JSON.stringify(doc, null, 2)}
        </pre>
      </div>

      <div style={styles.instructions}>
        <p>
          <strong>How to test:</strong> Open this page in two browser tabs.
          Edit in one tab. Watch the other tab update in real time.
        </p>
        <p>
          Both tabs edit "Status" at the same time? Last writer wins.
          One edits "Title", other edits "Body"? No conflict — both preserved.
        </p>
      </div>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: "700px",
    margin: "0 auto",
    padding: "20px",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  } as const,

  header: {
    marginBottom: "30px",
    borderBottom: "2px solid #e5e7eb",
    paddingBottom: "15px",
  } as const,

  title: {
    fontSize: "24px",
    margin: "0 0 10px 0",
  } as const,

  status: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "14px",
    color: "#6b7280",
  } as const,

  dot: {
    width: "10px",
    height: "10px",
    borderRadius: "50%",
    display: "inline-block",
  } as const,

  fields: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "20px",
    marginBottom: "30px",
  },

  fieldGroup: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "6px",
  },

  label: {
    fontSize: "14px",
    fontWeight: "600",
    color: "#374151",
  } as const,

  input: {
    padding: "10px 14px",
    fontSize: "16px",
    border: "1px solid #d1d5db",
    borderRadius: "8px",
    outline: "none",
  } as const,

  select: {
    padding: "10px 14px",
    fontSize: "16px",
    border: "1px solid #d1d5db",
    borderRadius: "8px",
    outline: "none",
    backgroundColor: "white",
  } as const,

  textarea: {
    padding: "10px 14px",
    fontSize: "16px",
    border: "1px solid #d1d5db",
    borderRadius: "8px",
    outline: "none",
    resize: "vertical" as const,
    fontFamily: "inherit",
  },

  stateViewer: {
    backgroundColor: "#1e293b",
    borderRadius: "8px",
    padding: "16px",
    marginBottom: "20px",
  } as const,

  stateTitle: {
    color: "#94a3b8",
    fontSize: "14px",
    margin: "0 0 10px 0",
  } as const,

  stateContent: {
    color: "#4ade80",
    fontSize: "13px",
    margin: 0,
    whiteSpace: "pre-wrap" as const,
  },

  instructions: {
    backgroundColor: "#eff6ff",
    borderRadius: "8px",
    padding: "16px",
    fontSize: "14px",
    color: "#1e40af",
    lineHeight: "1.6",
  } as const,
};