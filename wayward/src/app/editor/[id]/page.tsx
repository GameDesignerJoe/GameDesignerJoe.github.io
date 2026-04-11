"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Scenario } from "@/lib/types";
import { getScenario, saveScenario } from "@/lib/scenarios";

type Tab = "story" | "companion";

const EMOJI_OPTIONS = ["📖", "🏰", "🌲", "⚔️", "🌙", "🔮", "🗡️", "🐉", "🌊", "🏔️", "🕯️", "💀", "🎭", "🚀", "🌌"];

export default function EditorPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [tab, setTab] = useState<Tab>("story");
  const [showEmoji, setShowEmoji] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const s = getScenario(id);
    if (!s) {
      router.replace("/");
      return;
    }
    setScenario(s);
  }, [id, router]);

  const autoSave = useCallback(
    (updated: Scenario) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        saveScenario(updated);
      }, 400);
    },
    []
  );

  function update(patch: Partial<Scenario>) {
    if (!scenario) return;
    const updated = { ...scenario, ...patch };
    setScenario(updated);
    autoSave(updated);
  }

  function updateCompanion(patch: Partial<Scenario["companion"]>) {
    if (!scenario) return;
    const updated = {
      ...scenario,
      companion: { ...scenario.companion, ...patch },
    };
    setScenario(updated);
    autoSave(updated);
  }

  if (!scenario) return null;

  const isReady =
    scenario.title &&
    scenario.openingHook &&
    scenario.companion.name &&
    scenario.companion.voiceId;

  return (
    <div className="page">
      <div className="header">
        <button className="btn btn-ghost" onClick={() => router.push("/")}>
          ← Back
        </button>
        <div style={{ display: "flex", gap: 8 }}>
          {isReady && (
            <button
              className="btn btn-accent btn-sm"
              onClick={() => router.push(`/play/${id}`)}
            >
              ▶ Play
            </button>
          )}
          <button className="btn btn-surface btn-sm" onClick={() => router.push("/")}>
            Done
          </button>
        </div>
      </div>

      <div className="tabs">
        <button
          className={`tab ${tab === "story" ? "tab-active" : ""}`}
          onClick={() => setTab("story")}
        >
          Story
        </button>
        <button
          className={`tab ${tab === "companion" ? "tab-active" : ""}`}
          onClick={() => setTab("companion")}
        >
          Companion
        </button>
      </div>

      <div className="scroll-area" style={{ paddingBottom: 40 }}>
        {tab === "story" && (
          <>
            {/* Emoji picker */}
            <div className="field">
              <label className="field-label">Emoji</label>
              <div style={{ position: "relative" }}>
                <button
                  className="btn btn-surface"
                  style={{ fontSize: "1.5rem", width: 56, height: 56 }}
                  onClick={() => setShowEmoji(!showEmoji)}
                >
                  {scenario.emoji || "📖"}
                </button>
                {showEmoji && (
                  <div
                    style={{
                      position: "absolute",
                      top: 62,
                      left: 0,
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-sm)",
                      padding: 8,
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 4,
                      width: 240,
                      zIndex: 10,
                    }}
                  >
                    {EMOJI_OPTIONS.map((e) => (
                      <button
                        key={e}
                        style={{
                          fontSize: "1.4rem",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          padding: 6,
                          borderRadius: 6,
                        }}
                        onClick={() => {
                          update({ emoji: e });
                          setShowEmoji(false);
                        }}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="field">
              <label className="field-label">Title</label>
              <input
                type="text"
                value={scenario.title}
                onChange={(e) => update({ title: e.target.value.slice(0, 60) })}
                placeholder="Scenario name"
                maxLength={60}
              />
              <div className="field-hint">{scenario.title.length}/60</div>
            </div>

            <div className="field">
              <label className="field-label">Subtitle</label>
              <input
                type="text"
                value={scenario.subtitle}
                onChange={(e) => update({ subtitle: e.target.value.slice(0, 120) })}
                placeholder="One-line description shown on card"
                maxLength={120}
              />
              <div className="field-hint">{scenario.subtitle.length}/120</div>
            </div>

            <div className="field">
              <label className="field-label">Opening Hook</label>
              <textarea
                value={scenario.openingHook}
                onChange={(e) => update({ openingHook: e.target.value.slice(0, 4000) })}
                placeholder="Sets the stage. Narrator delivers this as the first thing in every session."
                rows={8}
                maxLength={4000}
              />
              <div className="field-hint">{scenario.openingHook.length}/4000</div>
            </div>

            <div className="field">
              <label className="field-label">AI Instructions</label>
              <textarea
                value={scenario.aiInstructions}
                onChange={(e) =>
                  update({ aiInstructions: e.target.value.slice(0, 2000) })
                }
                placeholder="How the AI should behave — tone, intensity, content, what to explore, what to avoid."
                rows={5}
                maxLength={2000}
              />
              <div className="field-hint">{scenario.aiInstructions.length}/2000</div>
            </div>
          </>
        )}

        {tab === "companion" && (
          <>
            <div className="field">
              <label className="field-label">Name</label>
              <input
                type="text"
                value={scenario.companion.name}
                onChange={(e) => updateCompanion({ name: e.target.value })}
                placeholder="Companion's name"
              />
            </div>

            <div className="field">
              <label className="field-label">Description</label>
              <textarea
                value={scenario.companion.description}
                onChange={(e) => updateCompanion({ description: e.target.value })}
                placeholder="Who they are, how they speak, their personality, relationship to player."
                rows={6}
              />
            </div>

            <div className="field">
              <label className="field-label">Voice</label>
              {scenario.companion.voiceName ? (
                <div
                  className="card"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 500 }}>{scenario.companion.voiceName}</div>
                    <div className="text-muted" style={{ fontSize: "0.8rem" }}>
                      Voice selected
                    </div>
                  </div>
                  <button
                    className="btn btn-surface btn-sm"
                    onClick={() => router.push(`/voices/${id}`)}
                  >
                    Change
                  </button>
                </div>
              ) : (
                <button
                  className="btn btn-accent"
                  style={{ width: "100%" }}
                  onClick={() => router.push(`/voices/${id}`)}
                >
                  Pick Voice
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
