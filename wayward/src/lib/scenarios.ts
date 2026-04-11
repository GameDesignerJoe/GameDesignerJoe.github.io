"use client";

import { Scenario } from "./types";

const STORAGE_KEY = "wayward_scenarios";
const SYNC_CODE_KEY = "wayward_sync_code";

function generateId(): string {
  return crypto.randomUUID();
}

export function getScenarios(): Scenario[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Scenario[];
  } catch {
    return [];
  }
}

export function getScenario(id: string): Scenario | null {
  return getScenarios().find((s) => s.id === id) ?? null;
}

// Debounced background cloud sync
let syncTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleCloudSync(): void {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    const code = localStorage.getItem(SYNC_CODE_KEY);
    if (!code) return;
    const scenarios = getScenarios();
    fetch("/api/sync", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, scenarios }),
    }).catch(() => {
      // Silent fail — cloud sync is best-effort
    });
  }, 2000);
}

export function saveScenario(scenario: Scenario): void {
  const scenarios = getScenarios();
  const idx = scenarios.findIndex((s) => s.id === scenario.id);
  scenario.updatedAt = new Date().toISOString();
  if (idx >= 0) {
    scenarios[idx] = scenario;
  } else {
    scenarios.push(scenario);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(scenarios));
  scheduleCloudSync();
}

export function deleteScenario(id: string): void {
  const scenarios = getScenarios().filter((s) => s.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(scenarios));
  scheduleCloudSync();
}

export function createScenario(): Scenario {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    title: "",
    subtitle: "",
    emoji: "📖",
    scenario: "",
    openingHook: "",
    playerCharacter: "",
    aiInstructions: "",
    companion: {
      name: "",
      description: "",
      voiceId: "",
      voiceName: "",
    },
    createdAt: now,
    updatedAt: now,
  };
}
