"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { CartesiaVoice, Scenario } from "@/lib/types";
import { getScenario, saveScenario } from "@/lib/scenarios";

type GenderFilter = "any" | "male" | "female" | "neutral";

export default function VoicePickerPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [voices, setVoices] = useState<CartesiaVoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gender, setGender] = useState<GenderFilter>("any");
  const [search, setSearch] = useState("");
  const [previewId, setPreviewId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const s = getScenario(id);
    if (!s) {
      router.replace("/");
      return;
    }
    setScenario(s);
  }, [id, router]);

  useEffect(() => {
    async function fetchVoices() {
      try {
        const res = await fetch("/api/voices");
        if (!res.ok) throw new Error("Failed to fetch voices");
        const data = await res.json();
        // Cartesia returns an array directly or nested in a field
        const list = Array.isArray(data) ? data : data.voices || [];
        // Filter to English, public voices
        const english = list.filter(
          (v: CartesiaVoice) => v.is_public && v.language === "en"
        );
        setVoices(english);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load voices");
      } finally {
        setLoading(false);
      }
    }
    fetchVoices();
  }, []);

  function stopPreview() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPreviewId(null);
  }

  async function handlePreview(voice: CartesiaVoice) {
    if (previewId === voice.id) {
      stopPreview();
      return;
    }
    stopPreview();
    setPreviewId(voice.id);

    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: "Hello, I could be the voice of your companion. What do you think?",
          voiceId: voice.id,
        }),
      });
      if (!res.ok) throw new Error("TTS failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.addEventListener("ended", () => {
        URL.revokeObjectURL(url);
        setPreviewId(null);
      });
      await audio.play();
    } catch {
      setPreviewId(null);
    }
  }

  function handleSelect(voice: CartesiaVoice) {
    if (!scenario) return;
    stopPreview();
    const updated = {
      ...scenario,
      companion: {
        ...scenario.companion,
        voiceId: voice.id,
        voiceName: voice.name,
        voicePreview: "",
      },
    };
    saveScenario(updated);
    router.push(`/editor/${id}`);
  }

  // Filter voices
  const filtered = voices.filter((v) => {
    if (search) {
      const q = search.toLowerCase();
      if (
        !v.name.toLowerCase().includes(q) &&
        !v.description.toLowerCase().includes(q)
      )
        return false;
    }
    if (gender !== "any") {
      const desc = v.description.toLowerCase();
      if (gender === "male" && !desc.includes("male") && !desc.includes(" man") && !desc.includes(" boy")) return false;
      if (gender === "female" && !desc.includes("female") && !desc.includes("woman") && !desc.includes(" girl")) return false;
      if (gender === "neutral" && (desc.includes("male") || desc.includes("female"))) return false;
    }
    return true;
  });

  if (!scenario) return null;

  return (
    <div className="page">
      <div className="header">
        <button className="btn btn-ghost" onClick={() => {
          stopPreview();
          router.push(`/editor/${id}`);
        }}>
          ← Back
        </button>
        <span className="header-title">Pick Voice</span>
        <div style={{ width: 60 }} />
      </div>

      {/* Search */}
      <div style={{ marginBottom: 12 }}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search voices..."
        />
      </div>

      {/* Gender filter */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {(["any", "male", "female", "neutral"] as GenderFilter[]).map((g) => (
          <button
            key={g}
            className={`btn btn-sm ${gender === g ? "btn-accent" : "btn-surface"}`}
            onClick={() => setGender(g)}
          >
            {g.charAt(0).toUpperCase() + g.slice(1)}
          </button>
        ))}
      </div>

      {/* Voice list */}
      <div className="scroll-area" style={{ paddingBottom: 32 }}>
        {loading && (
          <div style={{ textAlign: "center", padding: 40 }}>
            <p className="loading-pulse text-secondary">Loading voices...</p>
          </div>
        )}

        {error && (
          <div style={{ textAlign: "center", padding: 40 }}>
            <p style={{ color: "var(--danger)" }}>{error}</p>
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: 40 }}>
            <p className="text-secondary">No voices match your filters</p>
          </div>
        )}

        {filtered.map((voice) => (
          <div
            key={voice.id}
            className="card"
            style={{
              marginBottom: 8,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <button
              className="btn btn-icon btn-surface"
              onClick={() => handlePreview(voice)}
              title="Preview voice"
            >
              {previewId === voice.id ? "⏸" : "▶"}
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 500, fontSize: "0.95rem" }}>{voice.name}</div>
              <div
                className="text-muted"
                style={{
                  fontSize: "0.8rem",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {voice.description}
              </div>
            </div>
            <button
              className="btn btn-accent btn-sm"
              onClick={() => handleSelect(voice)}
            >
              Select
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
