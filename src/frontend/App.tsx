import React, { useRef, useEffect } from "react";
import { useDocument } from "./useDocument";
import { ConflictInfo } from "../crdt";

function useDebouncedCallback(
  callback: (field: string, value: string) => void,
  delay: number
) {
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

function SyncedInput({
  value,
  onChange,
  placeholder,
  style,
  conflict,
  onDismissConflict,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
  conflict?: ConflictInfo | null;
  onDismissConflict?: () => void;
}) {
  const [localValue, setLocalValue] = React.useState(value);
  const isTyping = useRef(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isTyping.current) {
      setLocalValue(value);
    }
  }, [value]);

  return (
    <div>
      <input
        style={{
          ...style,
          ...(conflict ? { borderColor: "#f59e0b", borderWidth: "2px" } : {}),
        }}
        placeholder={placeholder}
        value={localValue}
        onChange={(e) => {
          const newValue = e.target.value;
          setLocalValue(newValue);

          isTyping.current = true;
          if (typingTimer.current) {
            clearTimeout(typingTimer.current);
          }
          typingTimer.current = setTimeout(() => {
            isTyping.current = false;
          }, 1000);

          onChange(newValue);
        }}
        onBlur={() => {
          isTyping.current = false;
          setLocalValue(value);
        }}
      />
      {/* Conflict banner for this field */}
      {conflict && (
        <ConflictBanner conflict={conflict} onDismiss={onDismissConflict} />
      )}
    </div>
  );
}

function SyncedTextarea({
  value,
  onChange,
  placeholder,
  style,
  rows,
  conflict,
  onDismissConflict,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
  rows?: number;
  conflict?: ConflictInfo | null;
  onDismissConflict?: () => void;
}) {
  const [localValue, setLocalValue] = React.useState(value);
  const isTyping = useRef(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isTyping.current) {
      setLocalValue(value);
    }
  }, [value]);

  return (
    <div>
      <textarea
        style={{
          ...style,
          ...(conflict ? { borderColor: "#f59e0b", borderWidth: "2px" } : {}),
        }}
        placeholder={placeholder}
        rows={rows}
        value={localValue}
        onChange={(e) => {
          const newValue = e.target.value;
          setLocalValue(newValue);

          isTyping.current = true;
          if (typingTimer.current) {
            clearTimeout(typingTimer.current);
          }
          typingTimer.current = setTimeout(() => {
            isTyping.current = false;
          }, 1000);

          onChange(newValue);
        }}
        onBlur={() => {
          isTyping.current = false;
          setLocalValue(value);
        }}
      />
      {conflict && (
        <ConflictBanner conflict={conflict} onDismiss={onDismissConflict} />
      )}
    </div>
  );
}

function ConflictBanner({
  conflict,
  onDismiss,
}: {
  conflict: ConflictInfo;
  onDismiss?: () => void;
}) {
  return (
    <div style={styles.conflictBanner}>
      <div style={styles.conflictText}>
        <span style={styles.conflictIcon}>⚠️</span>
        <div>
          <strong>Conflict detected!</strong>
          <br />
          <span style={styles.conflictDetail}>
            <strong>{conflict.winner}</strong> won with "{String(conflict.winningValue)}"
            <br />
            <strong>{conflict.loser}</strong>'s value "{String(conflict.losingValue)}" was
            overwritten
          </span>
        </div>
      </div>
      {onDismiss && (
        <button style={styles.dismissButton} onClick={onDismiss}>
          Dismiss
        </button>
      )}
    </div>
  );
}

function OfflineBanner({ queueSize }: { queueSize: number }) {
  return (
    <div style={styles.offlineBanner}>
      <span style={styles.offlineIcon}>📡</span>
      <div>
        <strong>You're offline</strong>
        <br />
        <span style={styles.offlineDetail}>
          {queueSize === 0
            ? "Your edits will be saved locally and synced when reconnected."
            : `${queueSize} edit${queueSize > 1 ? "s" : ""} queued. Will sync when reconnected.`}
        </span>
      </div>
    </div>
  );
}

export function App() {
  const {
    doc,
    edit,
    connected,
    nodeId,
    conflicts,
    dismissConflict,
    offlineQueueSize,
  } = useDocument();

  const debouncedEdit = useDebouncedCallback(edit, 500);

  const getConflict = (field: string): ConflictInfo | null => {
    return conflicts.find((c) => c.field === field) ?? null;
  };

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

      {!connected && <OfflineBanner queueSize={offlineQueueSize} />}

      <div style={styles.fields}>
        <div style={styles.fieldGroup}>
          <label style={styles.label}>Title</label>
          <SyncedInput
            style={styles.input}
            placeholder="Document title..."
            value={(doc.title as string) ?? ""}
            onChange={(val) => debouncedEdit("title", val)}
            conflict={getConflict("title")}
            onDismissConflict={() => dismissConflict("title")}
          />
        </div>

        <div style={styles.fieldGroup}>
          <label style={styles.label}>Status</label>
          <div>
            <select
              style={{
                ...styles.select,
                ...(getConflict("status")
                  ? { borderColor: "#f59e0b", borderWidth: "2px" }
                  : {}),
              }}
              value={(doc.status as string) ?? "draft"}
              onChange={(e) => edit("status", e.target.value)}
            >
              <option value="draft">📝 Draft</option>
              <option value="review">👀 In Review</option>
              <option value="final">✅ Final</option>
            </select>
            {getConflict("status") && (
              <ConflictBanner
                conflict={getConflict("status")!}
                onDismiss={() => dismissConflict("status")}
              />
            )}
          </div>
        </div>

        <div style={styles.fieldGroup}>
          <label style={styles.label}>Body</label>
          <SyncedTextarea
            style={styles.textarea}
            placeholder="Start writing..."
            value={(doc.body as string) ?? ""}
            onChange={(val) => debouncedEdit("body", val)}
            rows={10}
            conflict={getConflict("body")}
            onDismissConflict={() => dismissConflict("body")}
          />
        </div>

        <div style={styles.fieldGroup}>
          <label style={styles.label}>Tags (comma separated)</label>
          <SyncedInput
            style={styles.input}
            placeholder="e.g. work, urgent, meeting"
            value={(doc.tags as string) ?? ""}
            onChange={(val) => debouncedEdit("tags", val)}
            conflict={getConflict("tags")}
            onDismissConflict={() => dismissConflict("tags")}
          />
        </div>
      </div>

      <div style={styles.stateViewer}>
        <h3 style={styles.stateTitle}>🔍 Live CRDT State</h3>
        <pre style={styles.stateContent}>
          {JSON.stringify(doc, null, 2)}
        </pre>
      </div>

      {conflicts.length > 0 && (
        <div style={styles.conflictLog}>
          <h3 style={styles.conflictLogTitle}>
            ⚡ Active Conflicts ({conflicts.length})
          </h3>
          {conflicts.map((c) => (
            <div key={c.field} style={styles.conflictLogItem}>
              <strong>{c.field}:</strong> {c.winner} won with "
              {String(c.winningValue)}" — {c.loser}'s "
              {String(c.losingValue)}" was overwritten
            </div>
          ))}
        </div>
      )}

      <div style={styles.instructions}>
        <h3 style={{ margin: "0 0 8px 0" }}>🧪 How to test:</h3>
        <p style={{ margin: "4px 0" }}>
          <strong>Real-time sync:</strong> Open two tabs. Edit title in one. Watch the other update.
        </p>
        <p style={{ margin: "4px 0" }}>
          <strong>Conflicts:</strong> Edit the same field in both tabs quickly. See ⚠️ conflict warning.
        </p>
        <p style={{ margin: "4px 0" }}>
          <strong>Offline:</strong> Stop the server (Ctrl+C). Keep editing. Restart server.
          Watch edits sync automatically.
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

  offlineBanner: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    backgroundColor: "#fef3c7",
    border: "1px solid #f59e0b",
    borderRadius: "8px",
    padding: "12px 16px",
    marginBottom: "20px",
  } as const,

  offlineIcon: {
    fontSize: "24px",
  } as const,

  offlineDetail: {
    fontSize: "13px",
    color: "#92400e",
  } as const,

  conflictBanner: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff7ed",
    border: "1px solid #f59e0b",
    borderRadius: "6px",
    padding: "8px 12px",
    marginTop: "6px",
    fontSize: "13px",
  } as const,

  conflictText: {
    display: "flex",
    alignItems: "flex-start",
    gap: "8px",
  } as const,

  conflictIcon: {
    fontSize: "18px",
  } as const,

  conflictDetail: {
    fontSize: "12px",
    color: "#92400e",
    lineHeight: "1.4",
  } as const,

  dismissButton: {
    padding: "4px 12px",
    fontSize: "12px",
    backgroundColor: "#f59e0b",
    color: "white",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
  } as const,

  conflictLog: {
    backgroundColor: "#fff7ed",
    border: "1px solid #fed7aa",
    borderRadius: "8px",
    padding: "16px",
    marginBottom: "20px",
  } as const,

  conflictLogTitle: {
    fontSize: "14px",
    margin: "0 0 10px 0",
    color: "#9a3412",
  } as const,

  conflictLogItem: {
    fontSize: "13px",
    color: "#92400e",
    padding: "4px 0",
  } as const,

  instructions: {
    backgroundColor: "#eff6ff",
    borderRadius: "8px",
    padding: "16px",
    fontSize: "14px",
    color: "#1e40af",
    lineHeight: "1.6",
  } as const,
};