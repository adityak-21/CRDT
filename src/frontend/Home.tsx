import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { listRooms } from "./storage";


function generateRoomId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function Home() {
  const navigate = useNavigate();
  const [joinId, setJoinId] = useState("");
  const [recentRooms, setRecentRooms] = useState<string[]>([]);

  useEffect(() => {
    listRooms().then(setRecentRooms);
  }, []);

  const createRoom = () => {
    const id = generateRoomId();
    navigate(`/room/${id}`);
  };

  const joinRoom = () => {
    if (joinId.trim()) {
      navigate(`/room/${joinId.trim()}`);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.hero}>
      <h1 style={styles.title}>⚡ CRDT Workspace</h1>
        <p style={styles.subtitle}>
            Real-time collaborative workspace — 6 CRDTs working together.
            <br />
            Document editing, task management, team voting — all offline-first, zero server logic.
        </p>
      </div>

      <div style={styles.card}>
        <h2 style={styles.cardTitle}>Create New Document</h2>
        <p style={styles.cardDesc}>
          Start a new collaborative document. Share the room code with others.
        </p>
        <button style={styles.primaryButton} onClick={createRoom}>
          ✨ Create Room
        </button>
      </div>

      <div style={styles.card}>
        <h2 style={styles.cardTitle}>Join Existing Room</h2>
        <p style={styles.cardDesc}>
          Enter a room code shared by someone else.
        </p>
        <div style={styles.joinRow}>
          <input
            style={styles.input}
            placeholder="Enter room code..."
            value={joinId}
            onChange={(e) => setJoinId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && joinRoom()}
          />
          <button style={styles.secondaryButton} onClick={joinRoom}>
            Join →
          </button>
        </div>
      </div>

      {recentRooms.length > 0 && (
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Recent Documents</h2>
          <p style={styles.cardDesc}>
            Documents you've edited before (persisted in your browser).
          </p>
          <div style={styles.roomList}>
            {recentRooms.map((id) => (
              <button
                key={id}
                style={styles.roomButton}
                onClick={() => navigate(`/room/${id}`)}
              >
                📄 {id}
              </button>
            ))}
          </div>
        </div>
      )}

    <div style={styles.features}>
    <div style={styles.feature}>
        <span style={styles.featureIcon}>✏️</span>
        <strong>Character-level merge</strong>
        <span style={styles.featureDesc}>
        Two people type simultaneously — both edits preserved
        </span>
    </div>
    <div style={styles.feature}>
        <span style={styles.featureIcon}>📡</span>
        <strong>Offline-first</strong>
        <span style={styles.featureDesc}>
        Edit without internet. Syncs when back online.
        </span>
    </div>
    <div style={styles.feature}>
        <span style={styles.featureIcon}>👻</span>
        <strong>Tombstones</strong>
        <span style={styles.featureDesc}>
        Deleted characters stay hidden, never lost
        </span>
    </div>
    <div style={styles.feature}>
        <span style={styles.featureIcon}>🧠</span>
        <strong>RGA Algorithm</strong>
        <span style={styles.featureDesc}>
        Same family as Google Docs & Figma
        </span>
    </div>
    </div>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: "600px",
    margin: "0 auto",
    padding: "40px 20px",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  } as const,

  hero: {
    textAlign: "center" as const,
    marginBottom: "40px",
  },

  title: {
    fontSize: "36px",
    margin: "0 0 10px 0",
  } as const,

  subtitle: {
    fontSize: "16px",
    color: "#6b7280",
    lineHeight: "1.6",
  } as const,

  card: {
    backgroundColor: "#ffffff",
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    padding: "24px",
    marginBottom: "20px",
  } as const,

  cardTitle: {
    fontSize: "18px",
    margin: "0 0 6px 0",
  } as const,

  cardDesc: {
    fontSize: "14px",
    color: "#6b7280",
    margin: "0 0 16px 0",
  } as const,

  primaryButton: {
    padding: "12px 24px",
    fontSize: "16px",
    backgroundColor: "#2563eb",
    color: "white",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    width: "100%",
    fontWeight: "600",
  } as const,

  joinRow: {
    display: "flex",
    gap: "10px",
  } as const,

  input: {
    flex: 1,
    padding: "10px 14px",
    fontSize: "16px",
    border: "1px solid #d1d5db",
    borderRadius: "8px",
    outline: "none",
  } as const,

  secondaryButton: {
    padding: "10px 20px",
    fontSize: "16px",
    backgroundColor: "#f3f4f6",
    color: "#374151",
    border: "1px solid #d1d5db",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: "600",
  } as const,

  roomList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "8px",
  },

  roomButton: {
    padding: "10px 14px",
    fontSize: "14px",
    backgroundColor: "#f9fafb",
    border: "1px solid #e5e7eb",
    borderRadius: "8px",
    cursor: "pointer",
    textAlign: "left" as const,
  } as const,

  features: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "16px",
    marginTop: "20px",
  } as const,

  feature: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "4px",
    padding: "16px",
    backgroundColor: "#f9fafb",
    borderRadius: "8px",
    fontSize: "14px",
  },

  featureIcon: {
    fontSize: "24px",
  } as const,

  featureDesc: {
    fontSize: "12px",
    color: "#6b7280",
  } as const,
};