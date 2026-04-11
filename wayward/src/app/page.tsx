"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Scenario } from "@/lib/types";
import { getScenarios, createScenario, saveScenario, deleteScenario } from "@/lib/scenarios";
import { primeAudio } from "@/lib/audio";
import { getSyncCode, setSyncCode, pushScenarios, pullScenarios } from "@/lib/sync";

export default function Home() {
  const router = useRouter();
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showSync, setShowSync] = useState(false);
  const [syncCode, setSyncCodeState] = useState("");
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    setScenarios(getScenarios());
    setSyncCodeState(getSyncCode());
    setLoaded(true);
  }, []);

  function handleNew() {
    const s = createScenario();
    saveScenario(s);
    router.push(`/editor/${s.id}`);
  }

  function handleDelete(id: string) {
    deleteScenario(id);
    setScenarios(getScenarios());
    // Auto-push after delete if sync is set up
    const code = getSyncCode();
    if (code) {
      pushScenarios(code, getScenarios());
    }
  }

  async function handlePush() {
    if (!syncCode.trim()) return;
    setSyncing(true);
    setSyncStatus(null);
    const code = syncCode.trim().toLowerCase();
    setSyncCode(code);
    setSyncCodeState(code);
    const ok = await pushScenarios(code, getScenarios());
    setSyncStatus(ok ? "Uploaded to cloud" : "Upload failed");
    setSyncing(false);
  }

  async function handlePull() {
    if (!syncCode.trim()) return;
    setSyncing(true);
    setSyncStatus(null);
    const code = syncCode.trim().toLowerCase();
    setSyncCode(code);
    setSyncCodeState(code);
    const remote = await pullScenarios(code);
    if (remote === null) {
      setSyncStatus("No data found for this code");
    } else {
      // Replace localStorage with cloud data
      localStorage.setItem("wayward_scenarios", JSON.stringify(remote));
      setScenarios(remote as Scenario[]);
      setSyncStatus(`Downloaded ${(remote as Scenario[]).length} scenarios`);
    }
    setSyncing(false);
  }

  function handleDisconnect() {
    setSyncCodeState("");
    setSyncCode("");
    setSyncStatus("Sync disconnected");
  }

  if (!loaded) return null;

  return (
    <div className="page">
      <div className="header">
        <h1 style={{ fontSize: "1.6rem", fontWeight: 700 }}>Wayward</h1>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ position: "relative" }}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setShowSync(!showSync)}
              title="Cloud Sync"
              style={{ fontSize: "0.85rem" }}
            >
              {syncCode ? "☁" : "☁"}
            </button>
            {showSync && (
              <>
                <div
                  style={{ position: "fixed", inset: 0, zIndex: 19 }}
                  onClick={() => setShowSync(false)}
                />
                <div
                  style={{
                    position: "absolute",
                    top: 36,
                    right: 0,
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-sm)",
                    padding: "14px 16px",
                    width: 260,
                    zIndex: 20,
                  }}
                >
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.75rem",
                      color: "var(--text-secondary)",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      marginBottom: 8,
                    }}
                  >
                    Cloud Sync
                  </label>
                  <input
                    type="text"
                    value={syncCode}
                    onChange={(e) => setSyncCodeState(e.target.value)}
                    placeholder="Enter a sync code..."
                    style={{ marginBottom: 10, fontSize: "0.85rem" }}
                  />
                  <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                    <button
                      className="btn btn-accent btn-sm"
                      style={{ flex: 1, fontSize: "0.75rem" }}
                      onClick={handlePush}
                      disabled={syncing || !syncCode.trim()}
                    >
                      {syncing ? "..." : "Upload"}
                    </button>
                    <button
                      className="btn btn-surface btn-sm"
                      style={{ flex: 1, fontSize: "0.75rem" }}
                      onClick={handlePull}
                      disabled={syncing || !syncCode.trim()}
                    >
                      {syncing ? "..." : "Download"}
                    </button>
                  </div>
                  {syncCode && (
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ width: "100%", fontSize: "0.7rem", color: "var(--text-muted)" }}
                      onClick={handleDisconnect}
                    >
                      Disconnect
                    </button>
                  )}
                  {syncStatus && (
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: syncStatus.includes("failed") || syncStatus.includes("No data")
                          ? "var(--danger)"
                          : "var(--accent)",
                        marginTop: 8,
                        textAlign: "center",
                      }}
                    >
                      {syncStatus}
                    </div>
                  )}
                  <div
                    style={{
                      fontSize: "0.65rem",
                      color: "var(--text-muted)",
                      marginTop: 10,
                      lineHeight: 1.4,
                    }}
                  >
                    Use the same code on any device to sync your scenarios.
                    Upload saves your local data. Download replaces it with cloud data.
                  </div>
                </div>
              </>
            )}
          </div>
          <button className="btn btn-accent btn-sm" onClick={handleNew}>
            + New Scenario
          </button>
        </div>
      </div>

      {scenarios.length === 0 ? (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
          }}
        >
          <p style={{ fontSize: "2rem" }}>📖</p>
          <p className="text-secondary">No scenarios yet</p>
          <button className="btn btn-accent" onClick={handleNew}>
            Create your first scenario
          </button>
        </div>
      ) : (
        <div className="scroll-area" style={{ paddingBottom: 32 }}>
          {scenarios.map((s) => (
            <div
              key={s.id}
              className="card"
              style={{
                marginBottom: 12,
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                cursor: "pointer",
              }}
              onClick={() => {
                if (s.title && s.openingHook && s.companion.name && s.companion.voiceId) {
                  primeAudio();
                  router.push(`/play/${s.id}`);
                } else {
                  router.push(`/editor/${s.id}`);
                }
              }}
            >
              <span style={{ fontSize: "2rem", lineHeight: 1 }}>{s.emoji || "📖"}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: "1rem" }}>
                  {s.title || "Untitled Scenario"}
                </div>
                {s.subtitle && (
                  <div className="text-secondary" style={{ fontSize: "0.85rem", marginTop: 2 }}>
                    {s.subtitle}
                  </div>
                )}
                {s.companion.name && (
                  <div className="text-muted" style={{ fontSize: "0.8rem", marginTop: 4 }}>
                    with {s.companion.name}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/editor/${s.id}`);
                  }}
                  title="Edit"
                >
                  ✏️
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm("Delete this scenario?")) {
                      handleDelete(s.id);
                    }
                  }}
                  title="Delete"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
