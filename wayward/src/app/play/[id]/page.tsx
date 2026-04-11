"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Scenario, ChatMessage, Exchange, InputMode, Emotion } from "@/lib/types";
import { getScenario } from "@/lib/scenarios";
import { buildSystemPrompt, wrapPlayerInput, parseResponse, buildOpeningMessages } from "@/lib/ai";
import { playTTS, stopAudio, toggleAudio, isPlaying, primeAudio } from "@/lib/audio";
import { RESPONSE_LENGTHS, getResponseLengthIndex, setResponseLengthIndex, getMaxTokens, NARRATION_STYLES, getNarrationStyle, setNarrationStyle, type NarrationStyle } from "@/lib/settings";

type Phase = "loading" | "playing";

function stripBracketTags(text: string): string {
  return text.replace(/\[([^\]]*)\]\s*/g, "").trim();
}

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
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [lengthIdx, setLengthIdx] = useState(1);
  const [narrationStyle, setNarrationStyleState] = useState<NarrationStyle>("voice");

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scenarioRef = useRef<Scenario | null>(null);
  const historyRef = useRef<ChatMessage[]>([]);

  // Keep refs in sync
  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  // Prime audio on first user gesture to unlock mobile autoplay
  useEffect(() => {
    function handleGesture() {
      primeAudio();
      document.removeEventListener("touchstart", handleGesture);
      document.removeEventListener("click", handleGesture);
    }
    document.addEventListener("touchstart", handleGesture, { once: true });
    document.addEventListener("click", handleGesture, { once: true });
    return () => {
      document.removeEventListener("touchstart", handleGesture);
      document.removeEventListener("click", handleGesture);
    };
  }, []);

  useEffect(() => {
    const s = getScenario(id);
    if (!s || !s.title || !s.companion.voiceId) {
      router.replace("/");
      return;
    }
    setScenario(s);
    scenarioRef.current = s;
    setLengthIdx(getResponseLengthIndex());
    setNarrationStyleState(getNarrationStyle());
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

  // Auto-dismiss errors
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 6000);
    return () => clearTimeout(t);
  }, [error]);

  // Send messages to AI and get response, injecting current style into system prompt
  const sendToAI = useCallback(
    async (messages: ChatMessage[]): Promise<string | null> => {
      // Replace system prompt with current narration style
      const s = scenarioRef.current;
      const styled = [...messages];
      if (s && styled.length > 0 && styled[0].role === "system") {
        styled[0] = { role: "system", content: buildSystemPrompt(s, getNarrationStyle()) };
      }
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: styled, max_tokens: getMaxTokens() }),
        });
        if (!res.ok) {
          if (res.status === 429) {
            setError("Groq rate limit reached — wait a moment and try again.");
          } else if (res.status === 402 || res.status === 403) {
            setError("Groq API quota exhausted — check your plan at groq.com.");
          } else {
            setError(`Groq API error (${res.status}).`);
          }
          return null;
        }
        const data = await res.json();
        return data.choices?.[0]?.message?.content ?? null;
      } catch {
        setError("Network error — couldn't reach the AI service.");
        return null;
      }
    },
    []
  );

  // Play companion audio
  const playCompanionAudio = useCallback(
    async (text: string) => {
      const s = scenarioRef.current;
      if (!s || !text || !s.companion.voiceId) return;
      setAudioPlaying(true);
      try {
        await playTTS(text, s.companion.voiceId, () => {
          setAudioPlaying(false);
        });
      } catch (e) {
        setAudioPlaying(false);
        setError(e instanceof Error ? e.message : "Audio playback failed.");
      }
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
        playCompanionAudio(parsed.companion);
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
      playCompanionAudio(parsed.companion);
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
      playCompanionAudio(parsed.companion);
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
      playCompanionAudio(parsed.companion);
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
            <>
            <div
              style={{
                position: "fixed",
                inset: 0,
                zIndex: 19,
              }}
              onClick={() => setShowSettings(false)}
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
                width: 220,
                zIndex: 20,
              }}
            >
              {/* Response length */}
              <label
                style={{
                  display: "block",
                  fontSize: "0.75rem",
                  color: "var(--text-secondary)",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  marginTop: 16,
                  marginBottom: 8,
                }}
              >
                Response Length: {RESPONSE_LENGTHS[lengthIdx].label}
              </label>
              <div style={{ display: "flex", gap: 4 }}>
                {RESPONSE_LENGTHS.map((opt, i) => (
                  <button
                    key={opt.label}
                    className={`btn btn-sm ${i === lengthIdx ? "btn-accent" : "btn-surface"}`}
                    style={{ flex: 1, padding: "6px 0", fontSize: "0.75rem" }}
                    onClick={() => {
                      setLengthIdx(i);
                      setResponseLengthIndex(i);
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {/* Narration style */}
              <label
                style={{
                  display: "block",
                  fontSize: "0.75rem",
                  color: "var(--text-secondary)",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  marginTop: 16,
                  marginBottom: 8,
                }}
              >
                Narration Style: {NARRATION_STYLES.find((s) => s.key === narrationStyle)?.label}
              </label>
              <div style={{ display: "flex", gap: 4 }}>
                {NARRATION_STYLES.map((opt) => (
                  <button
                    key={opt.key}
                    className={`btn btn-sm ${narrationStyle === opt.key ? "btn-accent" : "btn-surface"}`}
                    style={{ flex: 1, padding: "6px 0", fontSize: "0.75rem" }}
                    onClick={() => {
                      setNarrationStyleState(opt.key);
                      setNarrationStyle(opt.key);
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Error toast */}
      {error && (
        <div
          style={{
            background: "rgba(255, 74, 74, 0.12)",
            border: "1px solid var(--danger)",
            borderRadius: "var(--radius-sm)",
            padding: "10px 14px",
            margin: "8px 0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            flexShrink: 0,
          }}
        >
          <span style={{ color: "var(--danger)", fontSize: "0.85rem" }}>{error}</span>
          <button
            className="btn btn-ghost btn-sm"
            style={{ color: "var(--danger)", flexShrink: 0 }}
            onClick={() => setError(null)}
          >
            ✕
          </button>
        </div>
      )}

      {/* Narrative area — tap to stop audio */}
      <div
        ref={scrollRef}
        className="scroll-area"
        style={{ flex: 1, padding: "20px 0" }}
        onClick={() => {
          if (isPlaying()) {
            stopAudio();
            setAudioPlaying(false);
          }
        }}
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
                <div className="companion-text">{stripBracketTags(ex.companion)}</div>
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
                onClick={() => {
                  setInputMode(mode);
                  setTimeout(() => inputRef.current?.focus(), 10);
                }}
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
