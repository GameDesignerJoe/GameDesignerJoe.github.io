"use client";

let currentAudio: HTMLAudioElement | null = null;
let currentUrl: string | null = null;

// Persistent audio element — primed on first user gesture to satisfy
// mobile browser autoplay restrictions (iOS Safari, etc.)
let primedAudio: HTMLAudioElement | null = null;

export function primeAudio(): void {
  if (primedAudio) return;
  primedAudio = new Audio();
  primedAudio.src =
    "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
  primedAudio.volume = 0;
  primedAudio.play().catch(() => {
    primedAudio = null;
  });
}

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

export async function playTTS(
  text: string,
  voiceId: string,
  onEnd?: () => void
): Promise<HTMLAudioElement | null> {
  stopAudio();

  if (!text || !voiceId) return null;

  // Convert *expression* asterisk notation to [expression] bracket notation
  const transcript = text.replace(/\*([a-zA-Z]+)\*/g, "[$1]");

  const res = await fetch("/api/elevenlabs-tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: transcript, voiceId }),
  });

  if (!res.ok) {
    if (res.status === 429) {
      throw new Error("ElevenLabs rate limit reached — wait a moment and try again.");
    } else if (res.status === 402 || res.status === 403) {
      throw new Error("ElevenLabs API quota exhausted — check your plan.");
    }
    throw new Error(`ElevenLabs TTS error (${res.status}).`);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  currentUrl = url;

  const audio = primedAudio || new Audio();
  primedAudio = null;
  audio.src = url;
  audio.volume = 1;
  currentAudio = audio;

  audio.addEventListener("ended", () => {
    audio.currentTime = 0;
    onEnd?.();
  }, { once: true });

  await audio.play();
  return audio;
}
