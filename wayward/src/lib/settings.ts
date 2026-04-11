"use client";

const RESPONSE_LENGTH_KEY = "wayward_response_length";

export interface ResponseLengthOption {
  label: string;
  tokens: number;
}

export const RESPONSE_LENGTHS: ResponseLengthOption[] = [
  { label: "Short", tokens: 150 },
  { label: "Normal", tokens: 200 },
  { label: "Long", tokens: 350 },
  { label: "Epic", tokens: 500 },
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

// --- Narration style ---

const NARRATION_STYLE_KEY = "wayward_narration_style";

export type NarrationStyle = "story" | "blend" | "voice";

export interface NarrationStyleOption {
  key: NarrationStyle;
  label: string;
}

export const NARRATION_STYLES: NarrationStyleOption[] = [
  { key: "story", label: "Story" },
  { key: "blend", label: "Blend" },
  { key: "voice", label: "Voice" },
];

const DEFAULT_STYLE: NarrationStyle = "voice";

export function getNarrationStyle(): NarrationStyle {
  if (typeof window === "undefined") return DEFAULT_STYLE;
  const val = localStorage.getItem(NARRATION_STYLE_KEY) as NarrationStyle | null;
  if (val && NARRATION_STYLES.some((s) => s.key === val)) return val;
  return DEFAULT_STYLE;
}

export function setNarrationStyle(style: NarrationStyle): void {
  localStorage.setItem(NARRATION_STYLE_KEY, style);
}
