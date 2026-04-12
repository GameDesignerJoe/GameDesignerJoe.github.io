"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Scenario, ChatMessage, Exchange, InputMode, Section } from "@/lib/types";
import { getScenario } from "@/lib/scenarios";
import {
  buildSystemPrompt, wrapPlayerInput, parseResponse, buildOpeningMessages,
  buildDialogueSystemPrompt, parseDialogueResponse, buildDialogueOpeningMessages,
} from "@/lib/ai";
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
  if (/^["'\u201C\u2018]/.test(text.trim()) || /["'\u201D\u2019]$/.test(text.trim())) return "say";
  if (SAY_VERBS.test(text)) return "say";
  if (/^(I\b|my\b)/i.test(text.trim())) return "do";
  return "direct";
}

// Unique key for a chunk's audio state
function chunkKey(groupIdx: number, chunkIdx: number): string {
  return `${groupIdx}-${chunkIdx}`;
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
  const [sessionCredits, setSessionCredits] = useState(0);

  // === NARRATIVE MODE STATE ===
  const [displayStep, setDisplayStep] = useState(-1);
  const [stepComplete, setStepComplete] = useState(false);
  const [allRevealed, setAllRevealed] = useState(false);
  const [fading, setFading] = useState(false);
  const [audioPlayingIdx, setAudioPlayingIdx] = useState<number | null>(null);

  // === DIALOGUE MODE STATE ===
  // Each "chunk group" is one AI response's worth of chunks
  const [chunkGroups, setChunkGroups] = useState<string[][]>([]);
  const [chunkAudioState, setChunkAudioState] = useState<Record<string, "idle" | "loading" | "queued" | "playing" | "done">>({});
  const chunkAudioCache = useRef<Record<string, HTMLAudioElement>>({});
  const audioQueueRef = useRef<string[]>([]);
  const currentlyPlayingRef = useRef<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scenarioRef = useRef<Scenario | null>(null);
  const historyRef = useRef<ChatMessage[]>([]);

  const isDialogue = scenario?.mode === "dialogue";

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  // Prime audio on first user gesture
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

  async function fetchCredits() {
    try {
      const res = await fetch("/api/elevenlabs-usage");
      if (!res.ok) return;
      const data = await res.json();
      setCredits({ used: data.character_count, limit: data.character_limit, reset: new Date(data.next_character_count_reset_unix * 1000).toLocaleDateString() });
    } catch { /* ignore */ }
  }

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }, 50);
  }, []);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 6000);
    return () => clearTimeout(t);
  }, [error]);

  // === SEND TO AI (shared, but injects correct system prompt) ===
  const sendToAI = useCallback(
    async (messages: ChatMessage[]): Promise<string | null> => {
      const s = scenarioRef.current;
      const updated = [...messages];
      if (s && updated.length > 0 && updated[0].role === "system") {
        const hint = getResponseLengthHint();
        updated[0] = {
          role: "system",
          content: s.mode === "dialogue"
            ? buildDialogueSystemPrompt(s, hint)
            : buildSystemPrompt(s, hint),
        };
      }
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: updated, max_tokens: getMaxTokens() }),
        });
        if (!res.ok) {
          if (res.status === 429) setError("Groq rate limit reached — wait a moment and try again.");
          else if (res.status === 402 || res.status === 403) setError("Groq API quota exhausted — check your plan at groq.com.");
          else setError(`Groq API error (${res.status}).`);
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

  // ============================================================
  // NARRATIVE MODE LOGIC (unchanged)
  // ============================================================

  useEffect(() => {
    if (isDialogue) return;
    if (!stepComplete) return;
    const currentExchange = exchanges[exchanges.length - 1];
    if (!currentExchange) return;
    if (displayStep < currentExchange.sections.length - 1) {
      const timer = setTimeout(() => {
        setDisplayStep((prev) => prev + 1);
        setStepComplete(false);
        scrollToBottom();
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setAllRevealed(true);
    }
  }, [isDialogue, stepComplete, displayStep, exchanges, scrollToBottom]);

  useEffect(() => {
    if (isDialogue) return;
    const currentExchange = exchanges[exchanges.length - 1];
    if (!currentExchange || displayStep < 0 || stepComplete) return;
    const section = currentExchange.sections[displayStep];
    if (section && section.type === "dialogue") {
      setStepComplete(true);
      scrollToBottom();
    }
  }, [isDialogue, displayStep, exchanges, stepComplete, scrollToBottom]);

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

  async function handleNarrativeDialoguePlay(text: string, idx: number) {
    if (audioPlayingIdx === idx) {
      const playing = toggleAudio();
      if (!playing) setAudioPlayingIdx(null);
      return;
    }
    stopAudio();
    const s = scenarioRef.current;
    if (!s || !text) return;
    setAudioPlayingIdx(idx);
    setSessionCredits((prev) => prev + text.length);
    try {
      await playTTS(text, s.companion.voiceId, () => setAudioPlayingIdx(null));
    } catch (e) {
      setAudioPlayingIdx(null);
      setError(e instanceof Error ? e.message : "Audio playback failed.");
    }
  }

  // ============================================================
  // DIALOGUE MODE LOGIC
  // ============================================================

  function updateChunkState(key: string, state: "idle" | "loading" | "queued" | "playing" | "done") {
    setChunkAudioState((prev) => ({ ...prev, [key]: state }));
  }

  async function fetchChunkAudio(key: string, text: string): Promise<HTMLAudioElement | null> {
    if (chunkAudioCache.current[key]) return chunkAudioCache.current[key];
    const s = scenarioRef.current;
    if (!s) return null;
    try {
      const res = await fetch("/api/elevenlabs-tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voiceId: s.companion.voiceId }),
      });
      if (!res.ok) throw new Error(`TTS error (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      chunkAudioCache.current[key] = audio;
      setSessionCredits((prev) => prev + text.length);
      return audio;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Audio fetch failed.");
      return null;
    }
  }

  function playNextInQueue() {
    if (audioQueueRef.current.length === 0) {
      currentlyPlayingRef.current = null;
      return;
    }
    const nextKey = audioQueueRef.current.shift()!;
    const audio = chunkAudioCache.current[nextKey];
    if (audio) {
      currentlyPlayingRef.current = nextKey;
      updateChunkState(nextKey, "playing");
      audio.currentTime = 0;
      audio.addEventListener("ended", () => {
        updateChunkState(nextKey, "done");
        currentlyPlayingRef.current = null;
        playNextInQueue();
      }, { once: true });
      audio.play().catch(() => {
        updateChunkState(nextKey, "done");
        currentlyPlayingRef.current = null;
        playNextInQueue();
      });
    } else {
      // Audio not ready yet — wait and retry
      const check = setInterval(() => {
        if (chunkAudioCache.current[nextKey]) {
          clearInterval(check);
          currentlyPlayingRef.current = nextKey;
          updateChunkState(nextKey, "playing");
          const a = chunkAudioCache.current[nextKey];
          a.currentTime = 0;
          a.addEventListener("ended", () => {
            updateChunkState(nextKey, "done");
            currentlyPlayingRef.current = null;
            playNextInQueue();
          }, { once: true });
          a.play().catch(() => {
            updateChunkState(nextKey, "done");
            currentlyPlayingRef.current = null;
            playNextInQueue();
          });
        }
      }, 100);
      // Safety: clear after 30s
      setTimeout(() => clearInterval(check), 30000);
    }
  }

  async function handleChunkPlay(groupIdx: number, chunkIdx: number, text: string) {
    const key = chunkKey(groupIdx, chunkIdx);
    const state = chunkAudioState[key] || "idle";

    // If this chunk is currently playing, toggle pause
    if (state === "playing" && currentlyPlayingRef.current === key) {
      const audio = chunkAudioCache.current[key];
      if (audio) {
        audio.pause();
        updateChunkState(key, "done");
        currentlyPlayingRef.current = null;
        playNextInQueue();
      }
      return;
    }

    // Start loading
    updateChunkState(key, "loading");
    const audio = await fetchChunkAudio(key, text);
    if (!audio) {
      updateChunkState(key, "idle");
      return;
    }

    // If nothing is playing, play immediately
    if (!currentlyPlayingRef.current) {
      currentlyPlayingRef.current = key;
      updateChunkState(key, "playing");
      audio.currentTime = 0;
      audio.addEventListener("ended", () => {
        updateChunkState(key, "done");
        currentlyPlayingRef.current = null;
        playNextInQueue();
      }, { once: true });
      audio.play().catch(() => {
        updateChunkState(key, "done");
        currentlyPlayingRef.current = null;
        playNextInQueue();
      });
    } else {
      // Queue it
      updateChunkState(key, "queued");
      audioQueueRef.current.push(key);
    }
  }

  async function handlePlayAll(groupIdx: number, chunks: string[]) {
    // Fire all TTS requests simultaneously
    const keys = chunks.map((_, i) => chunkKey(groupIdx, i));
    keys.forEach((key) => updateChunkState(key, "loading"));

    // Start fetching all in parallel
    const promises = chunks.map((text, i) => fetchChunkAudio(keys[i], text));

    // Queue them in order
    for (let i = 0; i < keys.length; i++) {
      if (i === 0 && !currentlyPlayingRef.current) {
        // First one plays immediately when ready
        const audio = await promises[i];
        if (audio) {
          currentlyPlayingRef.current = keys[i];
          updateChunkState(keys[i], "playing");
          audio.currentTime = 0;
          audio.addEventListener("ended", () => {
            updateChunkState(keys[i], "done");
            currentlyPlayingRef.current = null;
            playNextInQueue();
          }, { once: true });
          audio.play().catch(() => {
            updateChunkState(keys[i], "done");
            currentlyPlayingRef.current = null;
            playNextInQueue();
          });
        }
      } else {
        // Queue the rest
        updateChunkState(keys[i], "queued");
        audioQueueRef.current.push(keys[i]);
        // Don't await — let them fetch in background
        promises[i].then(() => { /* cached now */ });
      }
    }
  }

  // ============================================================
  // SESSION START
  // ============================================================

  useEffect(() => {
    if (!scenario || phase !== "loading") return;
    let cancelled = false;

    async function startSession() {
      const hint = getResponseLengthHint();
      const msgs = isDialogue
        ? buildDialogueOpeningMessages(scenario!, hint)
        : buildOpeningMessages(scenario!, hint);
      setGenerating(true);
      const raw = await sendToAI(msgs);
      if (cancelled || !raw) { setGenerating(false); return; }

      const parsed = isDialogue ? parseDialogueResponse(raw) : parseResponse(raw);
      const assistantMsg: ChatMessage = { role: "assistant", content: raw };
      const fullHistory = [...msgs, assistantMsg];

      setHistory(fullHistory);

      if (isDialogue) {
        const chunks = parsed.sections.map((s) => s.text);
        setChunkGroups([chunks]);
      } else {
        setExchanges([{ playerInput: null, playerMode: null, sections: parsed.sections, emotion: parsed.emotion }]);
      }

      setGenerating(false);
      setPhase("playing");

      if (!isDialogue) {
        startDisplaySequence(true);
      }
      scrollToBottom();
    }

    startSession();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario, phase, sendToAI]);

  // ============================================================
  // HANDLERS (branched by mode)
  // ============================================================

  async function handleSubmit() {
    if (!inputText.trim() || generating) return;

    const text = inputText.trim();
    const mode = detectInputMode(text);
    setInputText("");
    setInputOpen(false);
    setGenerating(true);

    if (!isDialogue) {
      stopAudio();
      setAudioPlayingIdx(null);
    }

    const playerName = scenarioRef.current?.playerCharacter?.split(/[,.\n]/)[0]?.trim() || undefined;
    const wrapped = wrapPlayerInput(text, mode, playerName);
    const userMsg: ChatMessage = { role: "user", content: wrapped };
    const newHistory = [...historyRef.current, userMsg];

    let trimmed = newHistory;
    if (trimmed.length > 40) {
      trimmed = [trimmed[0], ...trimmed.slice(-20)];
    }

    const raw = await sendToAI(trimmed);
    if (!raw) { setGenerating(false); return; }

    const parsed = isDialogue ? parseDialogueResponse(raw) : parseResponse(raw);
    const assistantMsg: ChatMessage = { role: "assistant", content: raw };

    setHistory((prev) => [...prev, userMsg, assistantMsg]);

    if (isDialogue) {
      const chunks = parsed.sections.map((s) => s.text);
      setChunkGroups((prev) => [...prev, chunks]);
    } else {
      setExchanges((prev) => [...prev, { playerInput: text, playerMode: mode, sections: parsed.sections, emotion: parsed.emotion }]);
    }

    setGenerating(false);

    if (isDialogue) {
      scrollToBottom();
    } else {
      startDisplaySequence();
    }
  }

  async function handleContinue() {
    if (generating) return;

    if (!isDialogue) {
      stopAudio();
      setAudioPlayingIdx(null);
    }
    setGenerating(true);

    const continueMsg: ChatMessage = {
      role: "user",
      content: isDialogue
        ? "[SCENE DIRECTION]: Continue. Keep talking."
        : "[DIRECTION]: Continue the scene. Let the companion react or advance the atmosphere.",
    };
    const newHistory = [...historyRef.current, continueMsg];
    const raw = await sendToAI(newHistory);
    if (!raw) { setGenerating(false); return; }

    const parsed = isDialogue ? parseDialogueResponse(raw) : parseResponse(raw);
    const assistantMsg: ChatMessage = { role: "assistant", content: raw };

    setHistory((prev) => [...prev, continueMsg, assistantMsg]);

    if (isDialogue) {
      const chunks = parsed.sections.map((s) => s.text);
      setChunkGroups((prev) => [...prev, chunks]);
    } else {
      setExchanges((prev) => [...prev, { playerInput: null, playerMode: null, sections: parsed.sections, emotion: parsed.emotion }]);
    }

    setGenerating(false);

    if (isDialogue) {
      scrollToBottom();
    } else {
      startDisplaySequence();
    }
  }

  async function handleRetry() {
    if (generating) return;

    if (isDialogue) {
      if (chunkGroups.length === 0) return;
      setGenerating(true);
      // Remove last chunk group's audio cache
      const lastGroupIdx = chunkGroups.length - 1;
      const lastGroup = chunkGroups[lastGroupIdx];
      lastGroup.forEach((_, i) => {
        const key = chunkKey(lastGroupIdx, i);
        delete chunkAudioCache.current[key];
      });

      const trimmedHistory = historyRef.current.slice(0, -1);
      const raw = await sendToAI(trimmedHistory);
      if (!raw) { setGenerating(false); return; }

      const parsed = parseDialogueResponse(raw);
      const assistantMsg: ChatMessage = { role: "assistant", content: raw };
      const chunks = parsed.sections.map((s) => s.text);

      setHistory([...trimmedHistory, assistantMsg]);
      setChunkGroups((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = chunks;
        return updated;
      });
      setGenerating(false);
      scrollToBottom();
    } else {
      if (exchanges.length === 0) return;
      stopAudio();
      setAudioPlayingIdx(null);
      setGenerating(true);

      const trimmedHistory = historyRef.current.slice(0, -1);
      const raw = await sendToAI(trimmedHistory);
      if (!raw) { setGenerating(false); return; }

      const parsed = parseResponse(raw);
      const assistantMsg: ChatMessage = { role: "assistant", content: raw };

      setHistory([...trimmedHistory, assistantMsg]);
      setExchanges((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { ...updated[updated.length - 1], sections: parsed.sections, emotion: parsed.emotion };
        return updated;
      });
      setGenerating(false);
      startDisplaySequence();
    }
  }

  function handleErase() {
    if (isDialogue) {
      if (chunkGroups.length <= 1) return;
      // Clean up audio cache for last group
      const lastGroupIdx = chunkGroups.length - 1;
      const lastGroup = chunkGroups[lastGroupIdx];
      lastGroup.forEach((_, i) => {
        const key = chunkKey(lastGroupIdx, i);
        delete chunkAudioCache.current[key];
      });
      setChunkGroups((prev) => prev.slice(0, -1));
      setHistory((prev) => {
        const newHist = [...prev];
        if (newHist.length > 0 && newHist[newHist.length - 1].role === "assistant") newHist.pop();
        if (newHist.length > 0 && newHist[newHist.length - 1].role === "user") newHist.pop();
        return newHist;
      });
    } else {
      if (exchanges.length <= 1) return;
      stopAudio();
      setAudioPlayingIdx(null);
      setExchanges((prev) => prev.slice(0, -1));
      setHistory((prev) => {
        const newHist = [...prev];
        if (newHist.length > 0 && newHist[newHist.length - 1].role === "assistant") newHist.pop();
        if (newHist.length > 0 && newHist[newHist.length - 1].role === "user") newHist.pop();
        return newHist;
      });
      setAllRevealed(true);
      setDisplayStep(999);
      setStepComplete(true);
    }
  }

  // ============================================================
  // LOADING SCREEN
  // ============================================================

  if (phase === "loading" || !scenario) {
    return (
      <div className="page" style={{ alignItems: "center", justifyContent: "center", textAlign: "center", gap: 12 }}>
        <div style={{ fontSize: "3rem" }}>{scenario?.emoji || "📖"}</div>
        <h1 style={{ fontSize: "1.6rem" }}>{scenario?.title || "Loading..."}</h1>
        {scenario?.subtitle && <p className="text-secondary" style={{ fontSize: "0.9rem" }}>{scenario.subtitle}</p>}
        {scenario?.companion.name && <p className="text-muted" style={{ fontSize: "0.85rem", marginTop: 8 }}>with {scenario.companion.name}</p>}
        <p className="loading-pulse text-accent" style={{ marginTop: 24 }}>Preparing scene...</p>
      </div>
    );
  }

  // ============================================================
  // RENDER — DIALOGUE MODE
  // ============================================================

  if (isDialogue) {
    const canErase = chunkGroups.length > 1;
    const showActions = !generating;

    return (
      <div className="page" style={{ height: "100vh", overflow: "hidden" }}>
        {/* Header */}
        <div className="header" style={{ padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
          <button className="btn btn-ghost btn-sm" onClick={() => { stopAudio(); router.push("/"); }}>✕</button>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="text-secondary" style={{ fontSize: "0.85rem" }}>{scenario.title}{sessionCredits > 0 ? ` (${sessionCredits.toLocaleString()})` : ""}</span>
            <span className="text-muted" style={{ fontSize: "0.65rem", opacity: 0.6 }}>DIALOGUE</span>
          </div>
          <div style={{ position: "relative" }}>
            <button className="btn btn-ghost btn-sm" onClick={() => { const next = !showSettings; setShowSettings(next); if (next) fetchCredits(); }} title="Settings">⚙</button>
            {showSettings && (
              <>
                <div style={{ position: "fixed", inset: 0, zIndex: 19 }} onClick={() => setShowSettings(false)} />
                <div style={{ position: "absolute", top: 36, right: 0, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "14px 16px", width: 220, zIndex: 20 }}>
                  {credits && (() => {
                    const remaining = credits.limit - credits.used;
                    const pct = remaining / credits.limit;
                    const color = pct < 0.05 ? "var(--danger)" : pct < 0.25 ? "#ffb300" : "var(--text-secondary)";
                    return (<div style={{ fontSize: "0.7rem", color, marginBottom: 12, lineHeight: 1.4 }}>TTS Credits: {remaining.toLocaleString()} / {credits.limit.toLocaleString()}<br /><span style={{ color: "var(--text-muted)" }}>Resets {credits.reset}</span></div>);
                  })()}
                  <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.5px", marginTop: 16, marginBottom: 8 }}>Response Length: {RESPONSE_LENGTHS[lengthIdx].label}</label>
                  <div style={{ display: "flex", gap: 4 }}>
                    {RESPONSE_LENGTHS.map((opt, i) => (
                      <button key={opt.label} className={`btn btn-sm ${i === lengthIdx ? "btn-accent" : "btn-surface"}`} style={{ flex: 1, padding: "6px 0", fontSize: "0.75rem" }} onClick={() => { setLengthIdx(i); setResponseLengthIndex(i); }}>{opt.label}</button>
                    ))}
                  </div>
                  <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.5px", marginTop: 16, marginBottom: 8 }}>Audio Debug</label>
                  <button className={`btn btn-sm ${audioDebug ? "btn-accent" : "btn-surface"}`} style={{ width: "100%", padding: "6px 0", fontSize: "0.75rem" }} onClick={() => { const next = !audioDebug; setAudioDebug(next); setAudioDebugEnabled(next); if (next) logDeviceInfo(); }}>{audioDebug ? "On" : "Off"}</button>
                </div>
              </>
            )}
          </div>
        </div>

        {audioDebug && <AudioDebugOverlay onClose={() => { setAudioDebug(false); setAudioDebugEnabled(false); }} />}

        {error && (
          <div style={{ background: "rgba(255, 74, 74, 0.12)", border: "1px solid var(--danger)", borderRadius: "var(--radius-sm)", padding: "10px 14px", margin: "8px 0", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexShrink: 0 }}>
            <span style={{ color: "var(--danger)", fontSize: "0.85rem" }}>{error}</span>
            <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger)", flexShrink: 0 }} onClick={() => setError(null)}>✕</button>
          </div>
        )}

        {/* Chunks area */}
        <div ref={scrollRef} className="scroll-area" style={{ flex: 1, padding: "20px 0" }}>
          {chunkGroups.map((chunks, groupIdx) => (
            <div key={groupIdx} style={{ marginBottom: 24 }}>
              {chunks.map((text, chunkIdx) => {
                const key = chunkKey(groupIdx, chunkIdx);
                const state = chunkAudioState[key] || "idle";
                return (
                  <div
                    key={chunkIdx}
                    className="section-text dialogue-fade"
                    style={{ marginBottom: 12, display: "flex", alignItems: "flex-start", gap: 8, cursor: "pointer" }}
                    onClick={() => handleChunkPlay(groupIdx, chunkIdx, text)}
                  >
                    <span style={{ flexShrink: 0, fontSize: "0.85rem", width: 20, textAlign: "center", marginTop: 2 }}>
                      {state === "loading" ? "◌" : state === "playing" ? "⏸" : state === "queued" ? "•" : "▶"}
                    </span>
                    <span>{stripBracketTags(text)}</span>
                  </div>
                );
              })}
              {/* Play All button */}
              <button
                className="btn btn-ghost btn-sm"
                style={{ fontSize: "0.75rem", marginTop: 4 }}
                onClick={() => handlePlayAll(groupIdx, chunks)}
              >
                ▶ Play All
              </button>
            </div>
          ))}

          {generating && (
            <div className="loading-pulse" style={{ padding: "8px 0" }}>
              <span className="section-text">...</span>
            </div>
          )}
        </div>

        {/* Input panel */}
        {inputOpen && showActions && (
          <div style={{ borderTop: "1px solid var(--border)", padding: "12px 0", background: "var(--bg)" }}>
            <div style={{ display: "flex", gap: 8 }}>
              <textarea ref={inputRef} value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }} placeholder="Say, do, or direct the scene..." rows={2} style={{ flex: 1, resize: "none" }} autoFocus />
              <button className="btn btn-accent" onClick={handleSubmit} disabled={!inputText.trim() || generating} style={{ alignSelf: "flex-end" }}>→</button>
            </div>
          </div>
        )}

        {/* Action bar */}
        {showActions && (
          <div style={{ display: "flex", gap: 6, padding: "12px 0 16px", borderTop: inputOpen ? "none" : "1px solid var(--border)", background: "var(--bg)", flexShrink: 0 }}>
            <button className={`btn btn-sm ${inputOpen ? "btn-accent" : "btn-surface"}`} style={{ flex: 1 }} onClick={() => { setInputOpen(!inputOpen); if (!inputOpen) setTimeout(() => inputRef.current?.focus(), 100); }} disabled={generating}>Take a Turn</button>
            <button className="btn btn-surface btn-sm" style={{ flex: 1 }} onClick={handleContinue} disabled={generating}>Continue</button>
            <button className="btn btn-surface btn-sm" style={{ flex: 1 }} onClick={handleRetry} disabled={generating || chunkGroups.length === 0}>Retry</button>
            <button className="btn btn-surface btn-sm" style={{ flex: 1 }} onClick={handleErase} disabled={generating || !canErase}>Erase</button>
          </div>
        )}
      </div>
    );
  }

  // ============================================================
  // RENDER — NARRATIVE MODE (unchanged)
  // ============================================================

  const currentExchange = exchanges[exchanges.length - 1];

  return (
    <div className="page" style={{ height: "100vh", overflow: "hidden" }}>
      <div className="header" style={{ padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
        <button className="btn btn-ghost btn-sm" onClick={() => { stopAudio(); router.push("/"); }}>✕</button>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="text-secondary" style={{ fontSize: "0.85rem" }}>{scenario.title}{sessionCredits > 0 ? ` (${sessionCredits.toLocaleString()})` : ""}</span>
          <span className="text-muted" style={{ fontSize: "0.65rem", opacity: 0.6 }}>NARRATIVE</span>
        </div>
        <div style={{ position: "relative" }}>
          <button className="btn btn-ghost btn-sm" onClick={() => { const next = !showSettings; setShowSettings(next); if (next) fetchCredits(); }} title="Settings">⚙</button>
          {showSettings && (
            <>
              <div style={{ position: "fixed", inset: 0, zIndex: 19 }} onClick={() => setShowSettings(false)} />
              <div style={{ position: "absolute", top: 36, right: 0, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "14px 16px", width: 220, zIndex: 20 }}>
                {credits && (() => {
                  const remaining = credits.limit - credits.used;
                  const pct = remaining / credits.limit;
                  const color = pct < 0.05 ? "var(--danger)" : pct < 0.25 ? "#ffb300" : "var(--text-secondary)";
                  return (<div style={{ fontSize: "0.7rem", color, marginBottom: 12, lineHeight: 1.4 }}>TTS Credits: {remaining.toLocaleString()} / {credits.limit.toLocaleString()}<br /><span style={{ color: "var(--text-muted)" }}>Resets {credits.reset}</span></div>);
                })()}
                <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.5px", marginTop: 16, marginBottom: 8 }}>Response Length: {RESPONSE_LENGTHS[lengthIdx].label}</label>
                <div style={{ display: "flex", gap: 4 }}>
                  {RESPONSE_LENGTHS.map((opt, i) => (
                    <button key={opt.label} className={`btn btn-sm ${i === lengthIdx ? "btn-accent" : "btn-surface"}`} style={{ flex: 1, padding: "6px 0", fontSize: "0.75rem" }} onClick={() => { setLengthIdx(i); setResponseLengthIndex(i); }}>{opt.label}</button>
                  ))}
                </div>
                <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.5px", marginTop: 16, marginBottom: 8 }}>Audio Debug</label>
                <button className={`btn btn-sm ${audioDebug ? "btn-accent" : "btn-surface"}`} style={{ width: "100%", padding: "6px 0", fontSize: "0.75rem" }} onClick={() => { const next = !audioDebug; setAudioDebug(next); setAudioDebugEnabled(next); if (next) logDeviceInfo(); }}>{audioDebug ? "On" : "Off"}</button>
              </div>
            </>
          )}
        </div>
      </div>

      {audioDebug && <AudioDebugOverlay onClose={() => { setAudioDebug(false); setAudioDebugEnabled(false); }} />}

      {error && (
        <div style={{ background: "rgba(255, 74, 74, 0.12)", border: "1px solid var(--danger)", borderRadius: "var(--radius-sm)", padding: "10px 14px", margin: "8px 0", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexShrink: 0 }}>
          <span style={{ color: "var(--danger)", fontSize: "0.85rem" }}>{error}</span>
          <button className="btn btn-ghost btn-sm" style={{ color: "var(--danger)", flexShrink: 0 }} onClick={() => setError(null)}>✕</button>
        </div>
      )}

      <div ref={scrollRef} className="scroll-area" style={{ flex: 1, padding: "20px 0" }}>
        {currentExchange && (
          <div style={{ opacity: fading ? 0 : 1, transition: "opacity 0.4s ease-out" }}>
            {currentExchange.playerInput && (
              <div style={{ marginBottom: 16, paddingLeft: 12, borderLeft: "2px solid var(--border)" }}>
                <span className="text-muted" style={{ fontSize: "0.75rem" }}>
                  {currentExchange.playerMode === "say" ? "💬 You say" : currentExchange.playerMode === "do" ? "🏃 You do" : "🎬 Direction"}
                </span>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginTop: 4 }}>
                  {currentExchange.playerMode === "say" ? `"${currentExchange.playerInput}"` : currentExchange.playerInput}
                </p>
              </div>
            )}
            {currentExchange.sections.map((section, idx) => {
              if (idx > displayStep) return null;
              const isActive = idx === displayStep && !stepComplete;
              if (section.type === "narrative") {
                if (isActive) return <NarrativeRollout key={idx} text={section.text} onComplete={() => setStepComplete(true)} className="section-text" style={{ marginBottom: 16 }} />;
                return <div key={idx} className="section-text" style={{ marginBottom: 16 }}>{section.text}</div>;
              }
              if (section.type === "dialogue") {
                const isNewlyRevealed = idx === displayStep;
                return (
                  <div key={idx} className={`section-text${isNewlyRevealed ? " dialogue-fade" : ""}`} style={{ marginBottom: 16, cursor: "pointer" }} onClick={() => handleNarrativeDialoguePlay(section.text, idx)}>
                    <span style={{ display: "inline", marginRight: 6, fontSize: "0.85rem" }}>{audioPlayingIdx === idx ? "⏸" : "▶"}</span>
                    &ldquo;{stripBracketTags(section.text)}&rdquo;
                  </div>
                );
              }
              return null;
            })}
          </div>
        )}
        {generating && <div className="loading-pulse" style={{ padding: "8px 0" }}><span className="section-text">...</span></div>}
      </div>

      {inputOpen && allRevealed && (
        <div style={{ borderTop: "1px solid var(--border)", padding: "12px 0", background: "var(--bg)" }}>
          <div style={{ display: "flex", gap: 8 }}>
            <textarea ref={inputRef} value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }} placeholder="Say, do, or direct the scene..." rows={2} style={{ flex: 1, resize: "none" }} autoFocus />
            <button className="btn btn-accent" onClick={handleSubmit} disabled={!inputText.trim() || generating} style={{ alignSelf: "flex-end" }}>→</button>
          </div>
        </div>
      )}

      {allRevealed && !generating && (
        <div style={{ display: "flex", gap: 6, padding: "12px 0 16px", borderTop: inputOpen ? "none" : "1px solid var(--border)", background: "var(--bg)", flexShrink: 0 }}>
          <button className={`btn btn-sm ${inputOpen ? "btn-accent" : "btn-surface"}`} style={{ flex: 1 }} onClick={() => { setInputOpen(!inputOpen); if (!inputOpen) setTimeout(() => inputRef.current?.focus(), 100); }} disabled={generating}>Take a Turn</button>
          <button className="btn btn-surface btn-sm" style={{ flex: 1 }} onClick={handleContinue} disabled={generating}>Continue</button>
          <button className="btn btn-surface btn-sm" style={{ flex: 1 }} onClick={handleRetry} disabled={generating || exchanges.length === 0}>Retry</button>
          <button className="btn btn-surface btn-sm" style={{ flex: 1 }} onClick={handleErase} disabled={generating || exchanges.length <= 1}>Erase</button>
        </div>
      )}
    </div>
  );
}
