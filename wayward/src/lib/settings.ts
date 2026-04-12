"use client";

const RESPONSE_LENGTH_KEY = "wayward_response_length";

export interface ResponseLengthOption {
  label: string;
  tokens: number;
  promptHint: string;
}

export const RESPONSE_LENGTHS: ResponseLengthOption[] = [
  { label: "Short", tokens: 250, promptHint: "Keep responses brief — 2–3 sentences total across all blocks." },
  { label: "Normal", tokens: 400, promptHint: "Keep responses to 3–5 sentences total across all blocks." },
  { label: "Long", tokens: 600, promptHint: "Write richer responses — 5–8 sentences total across all blocks. Take time with description and atmosphere." },
  { label: "Epic", tokens: 800, promptHint: "Write vivid, immersive responses — 8–12 sentences total across all blocks. Paint the scene with detail, build tension, and let dialogue breathe." },
];

const DEFAULT_INDEX = 1; // Normal

export function getResponseLengthIndex(): number {
  if (typeof window === "undefined") return DEFAULT_INDEX;
  const val = localStorage.getItem(RESPONSE_LENGTH_KEY);
  if (!val) return DEFAULT_INDEX;
  const n = parseInt(val, 10);
  return isNaN(n) || n < 0 || n >= RESPONSE_LENGTHS.length ? DEFAULT_INDEX : n;
}

export function setResponseLengthIndex(index: number): void {
  localStorage.setItem(RESPONSE_LENGTH_KEY, String(index));
}

export function getMaxTokens(): number {
  return RESPONSE_LENGTHS[getResponseLengthIndex()].tokens;
}

export function getResponseLengthHint(): string {
  return RESPONSE_LENGTHS[getResponseLengthIndex()].promptHint;
}

// --- Audio debug ---

const AUDIO_DEBUG_KEY = "wayward_audio_debug";

export function getAudioDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(AUDIO_DEBUG_KEY) === "true";
}

export function setAudioDebugEnabled(enabled: boolean): void {
  localStorage.setItem(AUDIO_DEBUG_KEY, String(enabled));
}
