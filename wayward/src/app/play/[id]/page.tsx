"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Scenario, ChatMessage, Exchange, InputMode, Section } from "@/lib/types";
import { getScenario } from "@/lib/scenarios";
import { buildSystemPrompt, wrapPlayerInput, parseResponse, buildOpeningMessages } from "@/lib/ai";
import { playTTS, stopAudio, toggleAudio, primeAudio } from "@/lib/audio";
import { RESPONSE_LENGTHS, getResponseLengthIndex, setResponseLengthIndex, getMaxTokens, getResponseLengthHint, getAudioDebugEnabled, setAudioDebugEnabled } from "@/lib/settings";
import { logDeviceInfo } from "@/lib/audioDebug";
import { AudioDebugOverlay } from "@/lib/AudioDebugOverlay";
import { NarrativeRollout } from "@/lib/NarrativeRollout";

type Phase = "loading" | "playing";

function stripBracketTags(text: string): string {
  return text.replace(/\[([^\]]*)\]\s*/g, "").trim();
}

const SAY_VERBS = /\bI\s+(say|tell|ask|whisper|shout|yell|scream|call\s+out|reply|respond|answer|murmur|mutter|exclaim|announce|plead|beg|demand|insist|suggest|mention|add|continue)\b/i;

function detectInputMode(text: string): InputMode {
  // Quoted text → say
  if (/^["'\u201C\u2018]/.test(text.trim()) || /["'\u201D\u2019]$/.test(text.trim())) return "say";
  // Contains "I say/tell/ask/etc" → say
  if (SAY_VERBS.test(text)) return "say";
  // Starts with "I" or "my" → do (player action)
  if (/^(I\b|my\b)/i.test(text.trim())) return "do";
  // Otherwise → direct (scene instruction)
  return "direct";
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
  const [inputText, setInputText] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [lengthIdx, setLengthIdx] = useState(1);
  const [audioDebug, setAudioDebug] = useState(false);
  const [credits, setCredits] = useState<{ used: number; limit: number; reset: string } | null>(null);

  // Display sequence state
  const [displayStep, setDisplayStep] = useState(-1);
  const [stepComplete, setStepComplete] = useState(false);
  const [allRevealed, setAllRevealed] = useState(false);
  const [fading, setFading] = useState(false);

  // Audio state — which dialogue section index is currently playing
  const [audioPlayingIdx, setAudioPlayingIdx] = useState<number | null>(null);

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
    const debugOn = getAudioDebugEnabled();
    setAudioDebug(debugOn);
    if (debugOn) logDeviceInfo();
  }, [id, router]);

  // Fetch ElevenLabs credits
  async function fetchCredits() {
    try {
      const res = await fetch("/api/elevenlabs-usage");
      if (!res.ok) return;
      const data = await res.json();
      const remaining = data.character_limit - data.character_count;
      const resetDate = new Date(data.next_character_count_reset_unix * 1000).toLocaleDateString();
      setCredits({ used: data.character_count, limit: data.character_limit, reset: resetDate });
    } catch { /* ignore */ }
  }

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

  // Display sequence: advance step when current step completes
  useEffect(() => {
    if (!stepComplete) return;
    const currentExchange = exchanges[exchanges.length - 1];
    if (!currentExchange) return;
    const sections = currentExchange.sections;

    if (displayStep < sections.length - 1) {
      // Brief pause between sections, then advance
      const timer = setTimeout(() => {
        setDisplayStep((prev) => prev + 1);
        setStepComplete(false);
        scrollToBottom();
      }, 300);
      return () => clearTimeout(timer);
    } else {
      // All sections revealed
      setAllRevealed(true);
    }
  }, [stepComplete, displayStep, exchanges, scrollToBottom]);

  // When a dialogue section is revealed, mark it complete immediately
  // (dialogue appears all at once, no rollout)
  useEffect(() => {
    const currentExchange = exchanges[exchanges.length - 1];
    if (!currentExchange || displayStep < 0 || stepComplete) return;
    const section = currentExchange.sections[displayStep];
    if (section && section.type === "dialogue") {
      setStepComplete(true);
      scrollToBottom();
    }
  }, [displayStep, exchanges, stepComplete, scrollToBottom]);

  // Send messages to AI
  const sendToAI = useCallback(
    async (messages: ChatMessage[]): Promise<string | null> => {
      const s = scenarioRef.current;
      const updated = [...messages];
      if (s && updated.length > 0 && updated[0].role === "system") {
        updated[0] = { role: "system", content: buildSystemPrompt(s, getResponseLengthHint()) };
      }
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: updated, max_tokens: getMaxTokens() }),
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

  // Start display sequence for a new exchange
  // If there's existing content on screen, fade it out first
  function startDisplaySequence(isFirst = false) {
    stopAudio();
    setAudioPlayingIdx(null);
    if (!isFirst && exchanges.length > 0) {
      setFading(true);
      setTimeout(() => {
        setFading(false);
        setDisplayStep(0);
        setStepComplete(false);
        setAllRevealed(false);
      }, 400);
    } else {
      setFading(false);
      setDisplayStep(0);
      setStepComplete(false);
      setAllRevealed(false);
    }
  }

  // Play dialogue audio on demand
  async function handleDialoguePlay(text: string, idx: number) {
    if (audioPlayingIdx === idx) {
      const playing = toggleAudio();
      if (!playing) setAudioPlayingIdx(null);
      return;
    }
    stopAudio();
    const s = scenarioRef.current;
    if (!s || !text) return;
    setAudioPlayingIdx(idx);
    try {
      await playTTS(text, s.companion.voiceId, () => {
        setAudioPlayingIdx(null);
      });
    } catch (e) {
      setAudioPlayingIdx(null);
      setError(e instanceof Error ? e.message : "Audio playback failed.");
    }
  }

  // Begin session — generate opening
  useEffect(() => {
    if (!scenario || phase !== "loading") return;

    let cancelled = false;

    async function startSession() {
      const msgs = buildOpeningMessages(scenario!, getResponseLengthHint());
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
          sections: parsed.sections,
          emotion: parsed.emotion,
        },
      ]);
      setGenerating(false);
      setPhase("playing");
      startDisplaySequence(true);
    }

    startSession();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario, phase, sendToAI]);

  // Handle player submission
  async function handleSubmit() {
    if (!inputText.trim() || generating) return;

    stopAudio();
    setAudioPlayingIdx(null);

    const text = inputText.trim();
    const mode = detectInputMode(text);
    setInputText("");
    setInputOpen(false);
    setGenerating(true);

    const playerName = scenarioRef.current?.playerCharacter?.split(/[,.\n]/)[0]?.trim() || undefined;
    const wrapped = wrapPlayerInput(text, mode, playerName);
    const userMsg: ChatMessage = { role: "user", content: wrapped };
    const newHistory = [...historyRef.current, userMsg];

    // Trim context if too long
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
        sections: parsed.sections,
        emotion: parsed.emotion,
      },
    ]);
    setGenerating(false);
    startDisplaySequence();
  }

  // Continue — nudge the AI without player input
  async function handleContinue() {
    if (generating) return;

    stopAudio();
    setAudioPlayingIdx(null);
    setGenerating(true);

    const continueMsg: ChatMessage = {
      role: "user",
      content: "[DIRECTION]: Continue the scene. Let the companion react or advance the atmosphere.",
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
        sections: parsed.sections,
        emotion: parsed.emotion,
      },
    ]);
    setGenerating(false);
    startDisplaySequence();
  }

  // Retry — regenerate last AI response
  async function handleRetry() {
    if (generating || exchanges.length === 0) return;

    stopAudio();
    setAudioPlayingIdx(null);
    setGenerating(true);

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
        sections: parsed.sections,
        emotion: parsed.emotion,
      };
      return updated;
    });
    setGenerating(false);
    startDisplaySequence();
  }

  // Erase — remove last exchange, restore previous fully
  function handleErase() {
    if (exchanges.length <= 1) return;

    stopAudio();
    setAudioPlayingIdx(null);

    setExchanges((prev) => prev.slice(0, -1));
    setHistory((prev) => {
      const newHist = [...prev];
      if (newHist.length > 0 && newHist[newHist.length - 1].role === "assistant") {
        newHist.pop();
      }
      if (newHist.length > 0 && newHist[newHist.length - 1].role === "user") {
        newHist.pop();
      }
      return newHist;
    });

    // Show restored exchange fully — no animation
    setAllRevealed(true);
    setDisplayStep(999);
    setStepComplete(true);
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

  // Current exchange to display
  const currentExchange = exchanges[exchanges.length - 1];

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
            onClick={() => {
              const next = !showSettings;
              setShowSettings(next);
              if (next) fetchCredits();
            }}
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
              {/* ElevenLabs credits */}
              {credits && (() => {
                const remaining = credits.limit - credits.used;
                const pct = remaining / credits.limit;
                const color = pct < 0.05 ? "var(--danger)" : pct < 0.25 ? "#ffb300" : "var(--text-secondary)";
                return (
                  <div style={{ fontSize: "0.7rem", color, marginBottom: 12, lineHeight: 1.4 }}>
                    TTS Credits: {remaining.toLocaleString()} / {credits.limit.toLocaleString()}
                    <br />
                    <span style={{ color: "var(--text-muted)" }}>Resets {credits.reset}</span>
                  </div>
                );
              })()}
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
              {/* Audio Debug */}
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
                Audio Debug
              </label>
              <button
                className={`btn btn-sm ${audioDebug ? "btn-accent" : "btn-surface"}`}
                style={{ width: "100%", padding: "6px 0", fontSize: "0.75rem" }}
                onClick={() => {
                  const next = !audioDebug;
                  setAudioDebug(next);
                  setAudioDebugEnabled(next);
                  if (next) logDeviceInfo();
                }}
              >
                {audioDebug ? "On" : "Off"}
              </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Audio debug overlay */}
      {audioDebug && (
        <AudioDebugOverlay
          onClose={() => {
            setAudioDebug(false);
            setAudioDebugEnabled(false);
          }}
        />
      )}

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

      {/* Narrative area */}
      <div
        ref={scrollRef}
        className="scroll-area"
        style={{ flex: 1, padding: "20px 0" }}
      >
        {currentExchange && (
          <div
            style={{
              opacity: fading ? 0 : 1,
              transition: "opacity 0.4s ease-out",
            }}
          >
            {/* Player input */}
            {currentExchange.playerInput && (
              <div
                style={{
                  marginBottom: 16,
                  paddingLeft: 12,
                  borderLeft: "2px solid var(--border)",
                }}
              >
                <span className="text-muted" style={{ fontSize: "0.75rem" }}>
                  {currentExchange.playerMode === "say"
                    ? "💬 You say"
                    : currentExchange.playerMode === "do"
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
                  {currentExchange.playerMode === "say"
                    ? `"${currentExchange.playerInput}"`
                    : currentExchange.playerInput}
                </p>
              </div>
            )}

            {/* Sections with sequential reveal */}
            {currentExchange.sections.map((section, idx) => {
              if (idx > displayStep) return null;

              const isActive = idx === displayStep && !stepComplete;

              if (section.type === "narrative") {
                if (isActive) {
                  return (
                    <NarrativeRollout
                      key={idx}
                      text={section.text}
                      onComplete={() => setStepComplete(true)}
                      className="section-text"
                      style={{ marginBottom: 16 }}
                    />
                  );
                }
                return (
                  <div key={idx} className="section-text" style={{ marginBottom: 16 }}>
                    {section.text}
                  </div>
                );
              }

              if (section.type === "dialogue") {
                const isNewlyRevealed = idx === displayStep;
                return (
                  <div
                    key={idx}
                    className={`section-text${isNewlyRevealed ? " dialogue-fade" : ""}`}
                    style={{
                      marginBottom: 16,
                      cursor: "pointer",
                    }}
                    onClick={() => handleDialoguePlay(section.text, idx)}
                  >
                    <span
                      style={{
                        display: "inline",
                        marginRight: 6,
                        fontSize: "0.85rem",
                      }}
                    >
                      {audioPlayingIdx === idx ? "⏸" : "▶"}
                    </span>
                    &ldquo;{stripBracketTags(section.text)}&rdquo;
                  </div>
                );
              }

              return null;
            })}
          </div>
        )}

        {generating && (
          <div className="loading-pulse" style={{ padding: "8px 0" }}>
            <span className="section-text">...</span>
          </div>
        )}
      </div>

      {/* Input panel (when open) */}
      {inputOpen && allRevealed && (
        <div
          style={{
            borderTop: "1px solid var(--border)",
            padding: "12px 0",
            background: "var(--bg)",
          }}
        >
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
              placeholder={'Say, do, or direct the scene...'}
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

      {/* Action bar — only after display sequence completes */}
      {allRevealed && !generating && (
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
      )}
    </div>
  );
}
