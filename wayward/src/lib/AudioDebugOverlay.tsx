"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { getLogs, clearLogs, subscribe, formatLogsForClipboard, type AudioDebugEntry } from "./audioDebug";

const LEVEL_COLORS: Record<string, string> = {
  info: "#ccc",
  success: "#4caf50",
  warn: "#ffb300",
  error: "#ff4a4a",
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  return `${h}:${m}:${s}.${ms}`;
}

interface UsageData {
  character_count: number;
  character_limit: number;
  next_character_count_reset_unix: number;
}

export function AudioDebugOverlay({ onClose }: { onClose: () => void }) {
  const [logs, setLogs] = useState<AudioDebugEntry[]>([...getLogs()]);
  const [collapsed, setCollapsed] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [usageError, setUsageError] = useState(false);
  const [usageLoading, setUsageLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchUsage = useCallback(async () => {
    setUsageLoading(true);
    setUsageError(false);
    try {
      const res = await fetch("/api/elevenlabs-usage");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setUsage(data);
    } catch {
      setUsageError(true);
    } finally {
      setUsageLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  useEffect(() => {
    return subscribe(() => {
      const updated = getLogs();
      setLogs([...updated]);
      // Refresh credits after a TTS play completes or errors
      const last = updated[updated.length - 1];
      if (last && (last.step === "play" || last.step === "fetch") && (last.level === "success" || last.level === "error")) {
        fetchUsage();
      }
    });
  }, [fetchUsage]);

  useEffect(() => {
    if (!collapsed) {
      scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
    }
  }, [logs, collapsed]);

  async function handleCopy() {
    // Include credits info at the top of the copied text
    let header = "";
    if (usage) {
      const remaining = usage.character_limit - usage.character_count;
      const resetDate = new Date(usage.next_character_count_reset_unix * 1000).toLocaleDateString();
      header = `Credits: ${remaining.toLocaleString()} / ${usage.character_limit.toLocaleString()} remaining (resets ${resetDate})\n\n`;
    }
    const text = header + formatLogsForClipboard();
    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 1500);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 1500);
    }
  }

  // Credits color
  let creditsColor = "#4caf50"; // green
  let creditsText = "Credits: loading...";
  if (usageError) {
    creditsColor = "#888";
    creditsText = "Credits: unavailable";
  } else if (usage) {
    const remaining = usage.character_limit - usage.character_count;
    const pct = remaining / usage.character_limit;
    if (pct < 0.05) creditsColor = "#ff4a4a";
    else if (pct < 0.25) creditsColor = "#ffb300";
    const resetDate = new Date(usage.next_character_count_reset_unix * 1000).toLocaleDateString();
    creditsText = `Credits: ${remaining.toLocaleString()} / ${usage.character_limit.toLocaleString()} remaining (resets ${resetDate})`;
  }

  return (
    <div
      style={{
        flexShrink: 0,
        background: "rgba(0, 0, 0, 0.92)",
        borderBottom: "1px solid #333",
        fontFamily: "monospace",
        fontSize: 11,
        color: "#ccc",
      }}
    >
      {/* Header bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 10px",
          borderBottom: "1px solid #333",
        }}
      >
        <span style={{ fontWeight: "bold", color: "#b44aff" }}>
          Audio Debug
        </span>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={handleCopy} style={btnStyle}>
            {copyFeedback ? "Copied!" : "Copy"}
          </button>
          <button onClick={() => clearLogs()} style={btnStyle}>
            Clear
          </button>
          <button onClick={() => setCollapsed(!collapsed)} style={btnStyle}>
            {collapsed ? "Expand" : "Collapse"}
          </button>
          <button onClick={onClose} style={btnStyle}>
            Close
          </button>
        </div>
      </div>

      {/* Credits bar — always visible */}
      <div
        style={{
          padding: "4px 10px",
          borderBottom: collapsed ? "none" : "1px solid #333",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span style={{ color: creditsColor }}>
          {usageLoading && !usage ? "Credits: loading..." : creditsText}
        </span>
        <button onClick={fetchUsage} style={btnStyle}>
          ↻
        </button>
      </div>

      {/* Log entries */}
      {!collapsed && (
        <div
          ref={scrollRef}
          style={{
            maxHeight: "25vh",
            overflowY: "auto",
            padding: "4px 10px 8px",
          }}
        >
          {logs.length === 0 && (
            <div style={{ color: "#555", padding: "8px 0" }}>
              No log entries yet. Trigger audio playback to see the pipeline.
            </div>
          )}
          {logs.map((entry, i) => (
            <div key={i} style={{ padding: "1px 0", lineHeight: 1.4 }}>
              <span style={{ color: "#666" }}>{formatTime(entry.timestamp)}</span>{" "}
              <span style={{ color: LEVEL_COLORS[entry.level] || "#ccc" }}>
                [{entry.step}/{entry.level}]
              </span>{" "}
              <span>{entry.message}</span>
              {entry.data && (
                <span style={{ color: "#888" }}>
                  {" "}
                  {JSON.stringify(entry.data)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid #444",
  borderRadius: 4,
  color: "#aaa",
  fontSize: 10,
  padding: "2px 8px",
  cursor: "pointer",
};
