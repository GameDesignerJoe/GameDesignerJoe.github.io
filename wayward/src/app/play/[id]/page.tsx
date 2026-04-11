"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Scenario, ChatMessage, Exchange, InputMode, Emotion } from "@/lib/types";
import { getScenario } from "@/lib/scenarios";
import { buildSystemPrompt, wrapPlayerInput, parseResponse, buildOpeningMessages } from "@/lib/ai";
import { playTTS, stopAudio, toggleAudio, isPlaying, getTTSSpeed, setTTSSpeed } from "@/lib/audio";

type Phase = "loading" | "playing";

export default function PlayPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [inputOpen, setInputOpen] = useState(false);
  const [inputMode, setInputMode] = useState<InputMode>("say");
  const [inputText, setInputText] = useState("");
  const [generating, setGenerating] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [speed, setSpeed] = useState(1.0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scenarioRef = useRef<Scenario | null>(null);
  const historyRef = useRef<ChatMessage[]>([]);

  // Keep refs in sync
  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  useEffect(() => {
    const s = getScenario(id);
    if (!s || !s.title || !s.companion.voiceId) {
      router.replace("/");
      return;
    }
    setScenario(s);
    scenarioRef.current = s;
    setSpeed(getTTSSpeed());
  }, [id, router]);

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }, 50);
  }, []);

  // Send messages to AI and get response
  const sendToAI = useCallback(
    async (messages: ChatMessage[]): Promise<string | null> => {
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages }),
        });
        if (!res.ok) return null;
        const data = await res.json();
        return data.choices?.[0]?.message?.content ?? null;
      } catch {
        return null;
      }
    },
    []
  );

  // Play companion audio
  const playCompanionAudio = useCallback(
    async (text: string, emotion: Emotion = "neutral") => {
      const s = scenarioRef.current;
      if (!s || !text) return;
      setAudioPlaying(true);
      await playTTS(text, s.companion.voiceId, emotion, () => {
        setAudioPlaying(false);
      });
    },
    []
  );

  // Begin session — generate opening
  useEffect(() => {
    if (!scenario || phase !== "loading") return;

    let cancelled = false;

    async function startSession() {
      const msgs = buildOpeningMessages(scenario!);
      setGenerating(true);
      const raw = await sendToAI(msgs);
      if (cancelled || !raw) {
        setGenerating(false);
        return;
      }

      const parsed = parseResponse(raw);
      const assistantMsg: ChatMessage = { role: "assistant", content: raw };
      const fullHistory = [...msgs, assistantMsg];

      setHistory(fullHistory);
      setExchanges([
        {
          playerInput: null,
          playerMode: null,
          narrator: parsed.narrator,
          companion: parsed.companion,
          emotion: parsed.emotion,
        },
      ]);
      setGenerating(false);
      setPhase("playing");
      scrollToBottom();

      if (parsed.companion) {
        playCompanionAudio(parsed.companion, parsed.emotion);
      }
    }

    startSession();
    return () => { cancelled = true; };
  }, [scenario, phase, sendToAI, scrollToBottom, playCompanionAudio]);

  // Handle player submission
  async function handleSubmit() {
    if (!inputText.trim() || generating) return;

    stopAudio();
    setAudioPlaying(false);

    const text = inputText.trim();
    const mode = inputMode;
    setInputText("");
    setInputOpen(false);
    setGenerating(true);

    const wrapped = wrapPlayerInput(text, mode);
    const userMsg: ChatMessage = { role: "user", content: wrapped };
    const newHistory = [...historyRef.current, userMsg];

    // Trim context if too long — keep system prompt + companion anchor + recent exchanges
    let trimmed = newHistory;
    if (trimmed.length > 40) {
      const system = trimmed[0];
      const recent = trimmed.slice(-20);
      trimmed = [system, ...recent];
    }

    const raw = await sendToAI(trimmed);
    if (!raw) {
      setGenerating(false);
      return;
    }

    const parsed = parseResponse(raw);
    const assistantMsg: ChatMessage = { role: "assistant", content: raw };

    setHistory((prev) => [...prev, userMsg, assistantMsg]);
    setExchanges((prev) => [
      ...prev,
      {
        playerInput: text,
        playerMode: mode,
        narrator: parsed.narrator,
        companion: parsed.companion,
        emotion: parsed.emotion,
      },
    ]);
    setGenerating(false);
    scrollToBottom();

    if (parsed.companion) {
      playCompanionAudio(parsed.companion, parsed.emotion);
    }
  }

  // Continue — nudge the AI without player input
  async function handleContinue() {
    if (generating) return;

    stopAudio();
    setAudioPlaying(false);
    setGenerating(true);

    const continueMsg: ChatMessage = {
      role: "user",
      content: "[DIRECTION]: Continue the scene. Let the companion react or the narrator advance the atmosphere.",
    };
    const newHistory = [...historyRef.current, continueMsg];
    const raw = await sendToAI(newHistory);
    if (!raw) {
      setGenerating(false);
      return;
    }

    const parsed = parseResponse(raw);
    const assistantMsg: ChatMessage = { role: "assistant", content: raw };

    setHistory((prev) => [...prev, continueMsg, assistantMsg]);
    setExchanges((prev) => [
      ...prev,
      {
        playerInput: null,
        playerMode: null,
        narrator: parsed.narrator,
        companion: parsed.companion,
        emotion: parsed.emotion,
      },
    ]);
    setGenerating(false);
    scrollToBottom();

    if (parsed.companion) {
      playCompanionAudio(parsed.companion, parsed.emotion);
    }
  }

  // Retry — regenerate last AI response
  async function handleRetry() {
    if (generating || exchanges.length === 0) return;

    stopAudio();
    setAudioPlaying(false);
    setGenerating(true);

    // Remove last assistant message from history
    const trimmedHistory = historyRef.current.slice(0, -1);
    const raw = await sendToAI(trimmedHistory);
    if (!raw) {
      setGenerating(false);
      return;
    }

    const parsed = parseResponse(raw);
    const assistantMsg: ChatMessage = { role: "assistant", content: raw };

    setHistory([...trimmedHistory, assistantMsg]);
    setExchanges((prev) => {
      const updated = [...prev];
      updated[updated.length - 1] = {
        ...updated[updated.length - 1],
        narrator: parsed.narrator,
        companion: parsed.companion,
        emotion: parsed.emotion,
      };
      return updated;
    });
    setGenerating(false);
    scrollToBottom();

    if (parsed.companion) {
      playCompanionAudio(parsed.companion, parsed.emotion);
    }
  }

  // Erase — remove last exchange
  function handleErase() {
    if (exchanges.length <= 1) return;

    stopAudio();
    setAudioPlaying(false);

    // Remove last exchange
    setExchanges((prev) => prev.slice(0, -1));

    // Remove last user + assistant pair from history
    setHistory((prev) => {
      // Find last assistant message and the user message before it
      const newHist = [...prev];
      // Pop last assistant
      if (newHist.length > 0 && newHist[newHist.length - 1].role === "assistant") {
        newHist.pop();
      }
      // Pop last user
      if (newHist.length > 0 && newHist[newHist.length - 1].role === "user") {
        newHist.pop();
      }
      return newHist;
    });
  }

  function handleToggleAudio() {
    const playing = toggleAudio();
    setAudioPlaying(playing);
  }

  // Loading screen
  if (phase === "loading" || !scenario) {
    return (
      <div
        className="page"
        style={{
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          gap: 12,
        }}
      >
        <div style={{ fontSize: "3rem" }}>{scenario?.emoji || "📖"}</div>
        <h1 style={{ fontSize: "1.6rem" }}>{scenario?.title || "Loading..."}</h1>
        {scenario?.subtitle && (
          <p className="text-secondary" style={{ fontSize: "0.9rem" }}>
            {scenario.subtitle}
          </p>
        )}
        {scenario?.companion.name && (
          <p className="text-muted" style={{ fontSize: "0.85rem", marginTop: 8 }}>
            with {scenario.companion.name}
          </p>
        )}
        <p className="loading-pulse text-accent" style={{ marginTop: 24 }}>
          Preparing scene...
        </p>
      </div>
    );
  }

  // Visible exchanges — show last two only
  const visibleExchanges = exchanges.slice(-2);

  return (
    <div className="page" style={{ height: "100vh", overflow: "hidden" }}>
      {/* Minimal header */}
      <div
        className="header"
        style={{ padding: "12px 0", borderBottom: "1px solid var(--border)" }}
      >
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => {
            stopAudio();
            router.push("/");
          }}
        >
          ✕
        </button>
        <span className="text-secondary" style={{ fontSize: "0.85rem" }}>
          {scenario.title}
        </span>
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
                width: 220,
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
                Speech Speed: {speed.toFixed(1)}x
              </label>
              <input
                type="range"
                min="0.6"
                max="1.5"
                step="0.1"
                value={speed}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  setSpeed(v);
                  setTTSSpeed(v);
                }}
                style={{ width: "100%", accentColor: "var(--accent)" }}
              />
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "0.7rem",
                  color: "var(--text-muted)",
                  marginTop: 4,
                }}
              >
                <span>Slow</span>
                <span>Fast</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Narrative area */}
      <div
        ref={scrollRef}
        className="scroll-area"
        style={{ flex: 1, padding: "20px 0" }}
      >
        {visibleExchanges.map((ex, i) => (
          <div key={i} style={{ marginBottom: 24 }}>
            {/* Player input */}
            {ex.playerInput && (
              <div
                style={{
                  marginBottom: 16,
                  paddingLeft: 12,
                  borderLeft: "2px solid var(--border)",
                }}
              >
                <span className="text-muted" style={{ fontSize: "0.75rem" }}>
                  {ex.playerMode === "say"
                    ? "💬 You say"
                    : ex.playerMode === "do"
                    ? "🏃 You do"
                    : "🎬 Direction"}
                </span>
                <p
                  style={{
                    color: "var(--text-secondary)",
                    fontSize: "0.9rem",
                    marginTop: 4,
                  }}
                >
                  {ex.playerMode === "say" ? `"${ex.playerInput}"` : ex.playerInput}
                </p>
              </div>
            )}

            {/* Narrator text */}
            {ex.narrator && (
              <div className="narrator-text" style={{ marginBottom: 16 }}>
                {ex.narrator}
              </div>
            )}

            {/* Companion text */}
            {ex.companion && (
              <div style={{ marginBottom: 8 }}>
                <div className="companion-text">{ex.companion}</div>
                {/* Audio control — only on latest exchange */}
                {i === visibleExchanges.length - 1 && (
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ marginTop: 8, fontSize: "0.8rem" }}
                    onClick={handleToggleAudio}
                  >
                    {audioPlaying ? "⏸ Pause" : "▶ Play"} audio
                  </button>
                )}
              </div>
            )}
          </div>
        ))}

        {generating && (
          <div className="loading-pulse" style={{ padding: "8px 0" }}>
            <span className="narrator-text">...</span>
          </div>
        )}
      </div>

      {/* Input panel (when open) */}
      {inputOpen && (
        <div
          style={{
            borderTop: "1px solid var(--border)",
            padding: "12px 0",
            background: "var(--bg)",
          }}
        >
          {/* Mode selector */}
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            {(
              [
                { mode: "say" as InputMode, label: "💬 Say", desc: "Speak as your character" },
                { mode: "do" as InputMode, label: "🏃 Do", desc: "Describe an action" },
                { mode: "direct" as InputMode, label: "🎬 Direct", desc: "Narrator-level direction" },
              ] as const
            ).map(({ mode, label }) => (
              <button
                key={mode}
                className={`btn btn-sm ${inputMode === mode ? "btn-accent" : "btn-surface"}`}
                onClick={() => setInputMode(mode)}
              >
                {label}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <textarea
              ref={inputRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder={
                inputMode === "say"
                  ? 'What do you say?'
                  : inputMode === "do"
                  ? "What do you do?"
                  : "Direct the scene..."
              }
              rows={2}
              style={{ flex: 1, resize: "none" }}
              autoFocus
            />
            <button
              className="btn btn-accent"
              onClick={handleSubmit}
              disabled={!inputText.trim() || generating}
              style={{ alignSelf: "flex-end" }}
            >
              →
            </button>
          </div>
        </div>
      )}

      {/* Action bar */}
      <div
        style={{
          display: "flex",
          gap: 6,
          padding: "12px 0 16px",
          borderTop: inputOpen ? "none" : "1px solid var(--border)",
          background: "var(--bg)",
          flexShrink: 0,
        }}
      >
        <button
          className={`btn btn-sm ${inputOpen ? "btn-accent" : "btn-surface"}`}
          style={{ flex: 1 }}
          onClick={() => {
            setInputOpen(!inputOpen);
            if (!inputOpen) {
              setTimeout(() => inputRef.current?.focus(), 100);
            }
          }}
          disabled={generating}
        >
          Take a Turn
        </button>
        <button
          className="btn btn-surface btn-sm"
          style={{ flex: 1 }}
          onClick={handleContinue}
          disabled={generating}
        >
          Continue
        </button>
        <button
          className="btn btn-surface btn-sm"
          style={{ flex: 1 }}
          onClick={handleRetry}
          disabled={generating || exchanges.length === 0}
        >
          Retry
        </button>
        <button
          className="btn btn-surface btn-sm"
          style={{ flex: 1 }}
          onClick={handleErase}
          disabled={generating || exchanges.length <= 1}
        >
          Erase
        </button>
      </div>
    </div>
  );
}
