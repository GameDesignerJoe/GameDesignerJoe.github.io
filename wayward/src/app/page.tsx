"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Scenario } from "@/lib/types";
import { getScenarios, createScenario, saveScenario, deleteScenario } from "@/lib/scenarios";

export default function Home() {
  const router = useRouter();
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setScenarios(getScenarios());
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
        <button className="btn btn-accent btn-sm" onClick={handleNew}>
          + New Scenario
        </button>
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
