"use client";

import type { AudioProvider } from "./types";
import { getAudioProvider } from "./settings";

let currentAudio: HTMLAudioElement | null = null;
let currentUrl: string | null = null;

export function stopAudio(): void {
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
  if (!currentAudio) return false;
  if (currentAudio.paused) {
    currentAudio.play();
    return true;
  } else {
    currentAudio.pause();
    return false;
  }
}

export function isPlaying(): boolean {
  return currentAudio !== null && !currentAudio.paused;
}

// --- Settings persistence ---

const SPEED_KEY = "wayward_tts_speed";

export function getTTSSpeed(): number {
  if (typeof window === "undefined") return 1.0;
  const val = localStorage.getItem(SPEED_KEY);
  if (!val) return 1.0;
  const n = parseFloat(val);
  return isNaN(n) ? 1.0 : n;
}

export function setTTSSpeed(speed: number): void {
  localStorage.setItem(SPEED_KEY, String(speed));
}

export async function playTTS(
  text: string,
  voiceId: string,
  provider?: AudioProvider,
  onEnd?: () => void
): Promise<HTMLAudioElement | null> {
  stopAudio();

  if (!text || !voiceId) return null;

  const activeProvider = provider || getAudioProvider();

  // Convert *expression* asterisk notation to [expression] bracket notation
  const transcript = text.replace(/\*([a-zA-Z]+)\*/g, "[$1]");

  let endpoint: string;
  let body: Record<string, unknown>;

  if (activeProvider === "elevenlabs") {
    endpoint = "/api/elevenlabs-tts";
    body = { text: transcript, voiceId };
  } else {
    endpoint = "/api/tts";
    const speed = getTTSSpeed();
    body = { text: transcript, voiceId, speed };
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const label = activeProvider === "elevenlabs" ? "ElevenLabs" : "Cartesia";
    if (res.status === 429) {
      throw new Error(`${label} rate limit reached — wait a moment and try again.`);
    } else if (res.status === 402 || res.status === 403) {
      throw new Error(`${label} API quota exhausted — check your plan.`);
    }
    throw new Error(`${label} TTS error (${res.status}).`);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  currentUrl = url;

  const audio = new Audio(url);
  currentAudio = audio;

  audio.addEventListener("ended", () => {
    // Reset to start so the play button can replay it
    audio.currentTime = 0;
    onEnd?.();
  });

  await audio.play();
  return audio;
}
