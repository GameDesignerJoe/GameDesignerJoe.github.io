'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { useWizardStore } from '@/store/wizardStore';
import {
  calculateQuadrantPosition,
  clampPosition,
  GAME_POSITIONS,
  ZONE_LABELS,
  type QuadrantGame,
} from '@/lib/quadrantUtils';

const SCOPE_COLORS: Record<QuadrantGame['scope'], string> = {
  indie: 'rgb(var(--indie-t))',
  mid: 'rgb(var(--mid-t))',
  aaa: 'rgb(var(--aaa-t))',
};

// SVG uses 0–100 coordinate space (matches our axis units). y is flipped at render time
// so that y=0 (dark) sits at the bottom and y=100 (bright) sits at the top.
const flipY = (y: number) => 100 - y;

export default function QuadrantMap() {
  const state = useWizardStore();
  const setQuadrant = useWizardStore((s) => s.setQuadrant);
  const resetQuadrant = useWizardStore((s) => s.resetQuadrant);

  const auto = useMemo(() => calculateQuadrantPosition(state), [state]);
  // When manual, show the user's dragged position. Otherwise derive from DNA/tone live.
  const display = state.quadrantManual ? state.quadrantPosition : auto;

  const svgRef = useRef<SVGSVGElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [hoveredGame, setHoveredGame] = useState<QuadrantGame | null>(null);

  const toSvgCoords = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    const yPixel = ((clientY - rect.top) / rect.height) * 100;
    const y = 100 - yPixel; // flip back into our y-up axis
    return clampPosition({ x, y });
  }, []);

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const p = toSvgCoords(e.clientX, e.clientY);
    if (!p) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setDragging(true);
    setQuadrant(p, { manual: true });
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragging) return;
    const p = toSvgCoords(e.clientX, e.clientY);
    if (!p) return;
    setQuadrant(p, { manual: true });
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    setDragging(false);
  };

  return (
    <div className="relative w-full">
      <svg
        ref={svgRef}
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-auto aspect-square bg-surface border border-border rounded-lg touch-none select-none cursor-crosshair"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* Quadrant background gradient — subtle hint at the four moods */}
        <defs>
          <radialGradient id="brightLeft" cx="0%" cy="0%" r="60%">
            <stop offset="0%" stopColor="rgb(var(--accent))" stopOpacity="0.10" />
            <stop offset="100%" stopColor="rgb(var(--accent))" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="brightRight" cx="100%" cy="0%" r="60%">
            <stop offset="0%" stopColor="rgb(var(--mid-t))" stopOpacity="0.12" />
            <stop offset="100%" stopColor="rgb(var(--mid-t))" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="darkLeft" cx="0%" cy="100%" r="60%">
            <stop offset="0%" stopColor="rgb(var(--text-2))" stopOpacity="0.08" />
            <stop offset="100%" stopColor="rgb(var(--text-2))" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="darkRight" cx="100%" cy="100%" r="60%">
            <stop offset="0%" stopColor="rgb(var(--aaa-t))" stopOpacity="0.12" />
            <stop offset="100%" stopColor="rgb(var(--aaa-t))" stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect x="0" y="0" width="100" height="100" fill="url(#brightLeft)" />
        <rect x="0" y="0" width="100" height="100" fill="url(#brightRight)" />
        <rect x="0" y="0" width="100" height="100" fill="url(#darkLeft)" />
        <rect x="0" y="0" width="100" height="100" fill="url(#darkRight)" />

        {/* Grid: vertical + horizontal midlines */}
        <line x1="50" y1="0" x2="50" y2="100" stroke="rgb(var(--border-strong))" strokeWidth="0.15" strokeDasharray="0.6 0.6" />
        <line x1="0" y1="50" x2="100" y2="50" stroke="rgb(var(--border-strong))" strokeWidth="0.15" strokeDasharray="0.6 0.6" />

        {/* Game reference dots */}
        {GAME_POSITIONS.map((g) => {
          const [x, y] = g.pos;
          const isHovered = hoveredGame?.name === g.name;
          return (
            <g key={g.name}>
              <circle
                cx={x}
                cy={flipY(y)}
                r={isHovered ? 1.4 : 1.0}
                fill={SCOPE_COLORS[g.scope]}
                fillOpacity={isHovered ? 1 : 0.7}
                stroke="rgb(var(--bg))"
                strokeWidth="0.2"
                style={{ cursor: 'pointer', transition: 'r 0.12s, fill-opacity 0.12s' }}
                onPointerEnter={() => setHoveredGame(g)}
                onPointerLeave={() => setHoveredGame(null)}
              />
            </g>
          );
        })}

        {/* User dot — drawn last so it sits on top */}
        <g pointerEvents="none">
          <circle
            cx={display.x}
            cy={flipY(display.y)}
            r="3.2"
            fill="rgb(var(--accent))"
            stroke="rgb(var(--bg))"
            strokeWidth="0.7"
          />
          <circle
            cx={display.x}
            cy={flipY(display.y)}
            r="5.5"
            fill="none"
            stroke="rgb(var(--accent))"
            strokeWidth="0.4"
            opacity="0.55"
          />
        </g>
      </svg>

      {/* Axis labels — outside the SVG, positioned via absolute */}
      <div className="absolute top-2 left-3 text-[10px] font-semibold uppercase tracking-[.08em] text-text-3 pointer-events-none">
        {ZONE_LABELS.topLeft}
      </div>
      <div className="absolute top-2 right-3 text-[10px] font-semibold uppercase tracking-[.08em] text-text-3 pointer-events-none text-right">
        {ZONE_LABELS.topRight}
      </div>
      <div className="absolute bottom-2 left-3 text-[10px] font-semibold uppercase tracking-[.08em] text-text-3 pointer-events-none">
        {ZONE_LABELS.bottomLeft}
      </div>
      <div className="absolute bottom-2 right-3 text-[10px] font-semibold uppercase tracking-[.08em] text-text-3 pointer-events-none text-right">
        {ZONE_LABELS.bottomRight}
      </div>

      {/* Axis arrows below the SVG */}
      <div className="flex justify-between text-[10px] text-text-3 mt-2 px-1">
        <span>← Abstract</span>
        <span className="italic">drag the dot to override</span>
        <span>Realistic →</span>
      </div>

      {/* Hover tooltip */}
      {hoveredGame && (
        <HoverTooltip game={hoveredGame} />
      )}

      <div className="mt-3 flex items-center gap-3 flex-wrap text-[11px] text-text-3">
        <span>Scope:</span>
        <span className="inline-flex items-center gap-1">
          <span className="w-2 h-2 rounded-full" style={{ background: SCOPE_COLORS.indie }} />Indie
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-2 h-2 rounded-full" style={{ background: SCOPE_COLORS.mid }} />Mid-tier
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-2 h-2 rounded-full" style={{ background: SCOPE_COLORS.aaa }} />AAA
        </span>
        <span className="ml-auto">
          Position: <span className="text-text-2 font-mono">{Math.round(display.x)}, {Math.round(display.y)}</span>
        </span>
      </div>

      {state.quadrantManual && (
        <button
          type="button"
          className="btn btn-sm mt-3"
          onClick={resetQuadrant}
        >
          Reset to auto position
        </button>
      )}
    </div>
  );
}

function HoverTooltip({ game }: { game: QuadrantGame }) {
  const SCOPE_LABEL = { indie: 'Indie', mid: 'Mid-tier', aaa: 'AAA' } as const;
  // Position the tooltip in the top-right of the container; full coordinate-aware
  // positioning would require additional refs. Static placement reads well in practice.
  return (
    <div className="absolute top-10 right-3 bg-surface-2 border border-border-strong rounded px-2.5 py-1.5 text-[12px] shadow-lg pointer-events-none">
      <div className="font-semibold text-text">{game.name}</div>
      <div className="text-[10px] text-text-3 uppercase tracking-[.05em]">
        {SCOPE_LABEL[game.scope]} · {game.pos[0]}, {game.pos[1]}
      </div>
    </div>
  );
}
