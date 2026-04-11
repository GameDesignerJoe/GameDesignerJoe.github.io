"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Scenario, AudioProvider } from "@/lib/types";
import { getScenarios, createScenario, saveScenario, deleteScenario } from "@/lib/scenarios";
import { getAudioProvider, setAudioProvider } from "@/lib/settings";
import { primeAudio } from "@/lib/audio";

export default function Home() {
  const router = useRouter();
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [provider, setProviderState] = useState<AudioProvider>("cartesia");

  useEffect(() => {
    setScenarios(getScenarios());
    setProviderState(getAudioProvider());
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
              onClick={() => setShowSettings(!showSettings)}
              title="Settings"
            >
              ⚙
            </button>
            {showSettings && (
              <div
                style={{
                  position: "absolute",
                  top: 36,
                  right: 0,
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  padding: "14px 16px",
                  width: 240,
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
                  Audio Generator
                </label>
                <div style={{ display: "flex", gap: 4 }}>
                  {(["cartesia", "elevenlabs"] as AudioProvider[]).map((p) => (
                    <button
                      key={p}
                      className={`btn btn-sm ${provider === p ? "btn-accent" : "btn-surface"}`}
                      style={{ flex: 1, padding: "6px 0", fontSize: "0.75rem" }}
                      onClick={() => {
                        setProviderState(p);
                        setAudioProvider(p);
                      }}
                    >
                      {p === "cartesia" ? "Cartesia" : "ElevenLabs"}
                    </button>
                  ))}
                </div>
              </div>
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
          {scenarios.map((s) => {
            const hasAnyVoice =
              s.companion.cartesiaVoiceId ||
              s.companion.elevenLabsVoiceId ||
              s.companion.voiceId;
            return (
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
                  if (s.title && s.openingHook && s.companion.name && hasAnyVoice) {
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
            );
          })}
        </div>
      )}
    </div>
  );
}
