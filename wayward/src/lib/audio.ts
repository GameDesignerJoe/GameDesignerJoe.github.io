"use client";

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
  emotion?: string,
  onEnd?: () => void
): Promise<HTMLAudioElement | null> {
  stopAudio();

  if (!text || !voiceId) return null;

  // Convert *expression* asterisk notation to [expression] bracket notation
  // so Cartesia Sonic-3 renders them as actual audio (laughter, sighs, etc.)
  const transcript = text.replace(/\*([a-zA-Z]+)\*/g, "[$1]");

  const speed = getTTSSpeed();

  const res = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: transcript, voiceId, speed, emotion }),
  });

  if (!res.ok) return null;

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
