"use client";

import { useEffect, useState, useRef } from "react";

interface NarrativeRolloutProps {
  text: string;
  onComplete: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export function NarrativeRollout({ text, onComplete, className, style }: NarrativeRolloutProps) {
  const measureRef = useRef<HTMLDivElement>(null);
  const [visibleHeight, setVisibleHeight] = useState(0);
  const [totalHeight, setTotalHeight] = useState(0);
  const [lineHeight, setLineHeight] = useState(0);
  const [ready, setReady] = useState(false);
  const [done, setDone] = useState(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // Measure after fonts are loaded
  useEffect(() => {
    let cancelled = false;

    async function measure() {
      if (document.fonts?.ready) {
        await document.fonts.ready;
      }
      if (cancelled) return;

      const el = measureRef.current;
      if (!el) return;

      const computed = getComputedStyle(el);
      let lh = parseFloat(computed.lineHeight);
      if (isNaN(lh)) {
        lh = parseFloat(computed.fontSize) * 1.7;
      }
      const th = el.scrollHeight;

      setLineHeight(lh);
      setTotalHeight(th);
      setVisibleHeight(0);
      setDone(false);
      setReady(true);
    }

    measure();
    return () => { cancelled = true; };
  }, [text]);

  // Rollout interval
  useEffect(() => {
    if (!ready || lineHeight <= 0 || totalHeight <= 0) return;

    let currentHeight = 0;

    const interval = setInterval(() => {
      currentHeight += lineHeight;
      if (currentHeight >= totalHeight) {
        clearInterval(interval);
        setVisibleHeight(totalHeight);
        setDone(true);
        setTimeout(() => onCompleteRef.current(), 600);
      } else {
        setVisibleHeight(currentHeight);
      }
    }, 200);

    return () => clearInterval(interval);
  }, [ready, lineHeight, totalHeight]);

  // Fade mask: while rolling out, the bottom edge fades to transparent.
  // Once fully revealed, no mask needed.
  const fadeHeight = lineHeight * 1.5;
  const maskStyle: React.CSSProperties =
    ready && !done
      ? {
          maskImage: `linear-gradient(to bottom, black calc(100% - ${fadeHeight}px), transparent 100%)`,
          WebkitMaskImage: `linear-gradient(to bottom, black calc(100% - ${fadeHeight}px), transparent 100%)`,
        }
      : {};

  return (
    <div style={{ position: "relative", ...style }}>
      {/* Hidden measurement div */}
      <div
        ref={measureRef}
        aria-hidden="true"
        className={className}
        style={{
          position: "absolute",
          visibility: "hidden",
          pointerEvents: "none",
          width: "100%",
        }}
      >
        {text}
      </div>
      {/* Visible clipped div with fade edge */}
      <div
        className={className}
        style={{
          overflow: "hidden",
          maxHeight: ready ? visibleHeight : 0,
          transition: "max-height 0.25s ease-out",
          ...maskStyle,
        }}
      >
        {text}
      </div>
    </div>
  );
}
