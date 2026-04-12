"use client";

import { getAudioDebugEnabled } from "./settings";

export type LogLevel = "info" | "success" | "warn" | "error";

export interface AudioDebugEntry {
  timestamp: number;
  step: string;
  level: LogLevel;
  message: string;
  data?: Record<string, unknown>;
}

const MAX_ENTRIES = 200;
let logs: AudioDebugEntry[] = [];
let listeners: Set<() => void> = new Set();

function notify() {
  listeners.forEach((cb) => cb());
}

export function addLog(
  step: string,
  level: LogLevel,
  message: string,
  data?: Record<string, unknown>
): void {
  if (!getAudioDebugEnabled()) return;
  const entry: AudioDebugEntry = { timestamp: Date.now(), step, level, message };
  if (data) entry.data = data;
  logs.push(entry);
  if (logs.length > MAX_ENTRIES) logs.splice(0, logs.length - MAX_ENTRIES);
  notify();
}

export function getLogs(): AudioDebugEntry[] {
  return logs;
}

export function clearLogs(): void {
  logs = [];
  notify();
}

export function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  return `${h}:${m}:${s}.${ms}`;
}

export function formatLogsForClipboard(): string {
  const lines = logs.map((e) => {
    let line = `${formatTime(e.timestamp)} [${e.step}/${e.level}] ${e.message}`;
    if (e.data) line += " " + JSON.stringify(e.data);
    return line;
  });
  return lines.join("\n");
}

export function logDeviceInfo(): void {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "unknown";
  addLog("device", "info", "User agent", { ua });
  addLog("device", "info", "Platform", {
    platform: typeof navigator !== "undefined" ? navigator.platform : "unknown",
  });

  try {
    const AC =
      typeof AudioContext !== "undefined"
        ? AudioContext
        : typeof (window as unknown as Record<string, unknown>).webkitAudioContext !== "undefined"
        ? (window as unknown as Record<string, typeof AudioContext>).webkitAudioContext
        : null;
    if (AC) {
      const ctx = new AC();
      addLog("device", "info", "AudioContext state", { state: ctx.state });
      ctx.close();
    } else {
      addLog("device", "warn", "AudioContext not available");
    }
  } catch (e) {
    addLog("device", "error", "AudioContext probe failed", {
      error: String(e),
    });
  }
}
