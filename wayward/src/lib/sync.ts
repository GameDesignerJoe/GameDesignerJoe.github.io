"use client";

const SYNC_CODE_KEY = "wayward_sync_code";

export function getSyncCode(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(SYNC_CODE_KEY) || "";
}

export function setSyncCode(code: string): void {
  localStorage.setItem(SYNC_CODE_KEY, code.trim().toLowerCase());
}

export function clearSyncCode(): void {
  localStorage.removeItem(SYNC_CODE_KEY);
}

/**
 * Upload local scenarios to cloud storage.
 */
export async function pushScenarios(code: string, scenarios: unknown[]): Promise<boolean> {
  try {
    const res = await fetch("/api/sync", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, scenarios }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Download scenarios from cloud storage.
 * Returns null if no data exists for this code.
 */
export async function pullScenarios(code: string): Promise<unknown[] | null> {
  try {
    const res = await fetch(`/api/sync?code=${encodeURIComponent(code)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.scenarios ?? null;
  } catch {
    return null;
  }
}
