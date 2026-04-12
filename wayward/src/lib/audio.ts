"use client";

import { addLog } from "./audioDebug";

let currentAudio: HTMLAudioElement | null = null;
let currentUrl: string | null = null;

// Persistent audio element — primed on first user gesture to satisfy
// mobile browser autoplay restrictions (iOS Safari, etc.)
let primedAudio: HTMLAudioElement | null = null;

export function primeAudio(): void {
  if (primedAudio) {
    addLog("prime", "info", "primeAudio called — already primed, skipping");
    return;
  }
  addLog("prime", "info", "primeAudio called — creating silent audio element");
  primedAudio = new Audio();
  primedAudio.src =
    "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
  primedAudio.volume = 0;
  primedAudio.play().then(() => {
    addLog("prime", "success", "Silent audio play succeeded");
  }).catch((e) => {
    addLog("prime", "error", "Silent audio play failed", {
      error: String(e),
      name: e?.name,
    });
    primedAudio = null;
  });
}

export function stopAudio(): void {
  addLog("stop", "info", "stopAudio called", {
    hadAudio: !!currentAudio,
    hadUrl: !!currentUrl,
  });
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
  }
  if (currentUrl) {
    URL.revokeObjectURL(currentUrl);
    currentUrl = null;
  }
  currentAudio = null;
}

export function toggleAudio(): boolean {
  if (!currentAudio) {
    addLog("toggle", "warn", "toggleAudio called — no current audio element");
    return false;
  }
  if (currentAudio.paused) {
    addLog("toggle", "info", "toggleAudio — resuming playback");
    currentAudio.play().catch((e) => {
      addLog("toggle", "error", "Resume play() failed", {
        error: String(e),
        name: e?.name,
      });
    });
    return true;
  } else {
    addLog("toggle", "info", "toggleAudio — pausing");
    currentAudio.pause();
    return false;
  }
}

export function isPlaying(): boolean {
  return currentAudio !== null && !currentAudio.paused;
}

export async function playTTS(
  text: string,
  voiceId: string,
  onEnd?: () => void
): Promise<HTMLAudioElement | null> {
  stopAudio();

  if (!text || !voiceId) {
    addLog("playTTS", "warn", "playTTS called with empty text or voiceId", {
      hasText: !!text,
      hasVoiceId: !!voiceId,
    });
    return null;
  }

  addLog("playTTS", "info", "Starting TTS pipeline", {
    textLength: text.length,
    voiceId,
    hasPrimedAudio: !!primedAudio,
  });

  // Convert *expression* asterisk notation to [expression] bracket notation
  const transcript = text.replace(/\*([a-zA-Z]+)\*/g, "[$1]");

  // --- Fetch TTS audio ---
  addLog("fetch", "info", "POST /api/elevenlabs-tts", {
    transcriptLength: transcript.length,
    voiceId,
  });

  let res: Response;
  try {
    res = await fetch("/api/elevenlabs-tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: transcript, voiceId }),
    });
  } catch (e) {
    addLog("fetch", "error", "Network fetch failed", { error: String(e) });
    throw e;
  }

  addLog("fetch", res.ok ? "success" : "error", `Response ${res.status}`, {
    status: res.status,
    contentType: res.headers.get("content-type"),
    ok: res.ok,
  });

  if (!res.ok) {
    // Log the full error body for debugging
    let errorDetail = "";
    try {
      const errBody = await res.clone().text();
      errorDetail = errBody;
      addLog("fetch", "error", "Response body", { body: errBody.slice(0, 500) });
    } catch { /* ignore */ }

    if (res.status === 429) {
      throw new Error("ElevenLabs rate limit reached — wait a moment and try again.");
    } else if (res.status === 401 || res.status === 402 || res.status === 403) {
      // ElevenLabs returns 401 for quota exceeded, not just auth failures
      const isQuota = errorDetail.includes("quota_exceeded") || errorDetail.includes("credits remaining");
      throw new Error(
        isQuota
          ? "ElevenLabs character quota exhausted — check your plan or wait for reset."
          : `ElevenLabs auth error (${res.status}) — check your API key.`
      );
    }
    throw new Error(`ElevenLabs TTS error (${res.status}).`);
  }

  // --- Create blob and object URL ---
  const blob = await res.blob();
  addLog("blob", "info", "Blob received", { size: blob.size, type: blob.type });
  addLog("credits", "info", `TTS request used ~${transcript.length} credits`, { characters: transcript.length });

  const url = URL.createObjectURL(blob);
  currentUrl = url;
  addLog("blob", "success", "ObjectURL created");

  // --- Prepare audio element ---
  const usingPrimed = !!primedAudio;
  const audio = primedAudio || new Audio();
  primedAudio = null;
  audio.src = url;
  audio.volume = 1;
  currentAudio = audio;

  addLog("element", "info", usingPrimed ? "Using primed audio element" : "Created new Audio()", {
    readyState: audio.readyState,
    networkState: audio.networkState,
  });

  // Listen for audio element errors
  audio.addEventListener("error", () => {
    addLog("element", "error", "Audio element error event fired", {
      code: audio.error?.code,
      message: audio.error?.message,
      networkState: audio.networkState,
      readyState: audio.readyState,
    });
  }, { once: true });

  audio.addEventListener("ended", () => {
    addLog("playback", "success", "Audio ended naturally", {
      duration: audio.duration,
    });
    audio.currentTime = 0;
    onEnd?.();
  }, { once: true });

  // --- Play ---
  addLog("play", "info", "Calling audio.play()", {
    readyState: audio.readyState,
    networkState: audio.networkState,
    paused: audio.paused,
  });

  try {
    await audio.play();
    addLog("play", "success", "audio.play() resolved", {
      duration: audio.duration,
      readyState: audio.readyState,
    });
  } catch (e) {
    addLog("play", "error", "audio.play() rejected", {
      error: String(e),
      name: (e as Error)?.name,
      message: (e as Error)?.message,
      readyState: audio.readyState,
      networkState: audio.networkState,
      audioError: audio.error
        ? { code: audio.error.code, message: audio.error.message }
        : null,
    });
    throw e;
  }

  return audio;
}
