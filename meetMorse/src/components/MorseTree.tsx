import { useMemo } from 'react';
import {
  ANTENNA,
  TREE_EDGES,
  TREE_NODES,
  TREE_VIEWBOX,
  type TreeNode,
} from '../data/morseTree';
import { useInputStore } from '../stores/inputStore';

const DOT_RADIUS = 2.2;
const DASH_WIDTH = 6;
const DASH_HEIGHT = 2.8;

const LABEL_BASELINE_OFFSET = 7.2;
const LABEL_PLATE_W = 4.2;
const LABEL_PLATE_H = 4.4;

const COLOR_EDGE_IDLE = 'rgba(70, 50, 25, 0.85)';
const COLOR_EDGE_ON_PATH = '#f0c87a';

const COLOR_NODE_IDLE_STROKE = '#3a2a15';
const COLOR_NODE_ON_PATH_FILL = '#ffd17a';
const COLOR_NODE_CURRENT_FILL = '#fff1c2';
const COLOR_NODE_ERROR = '#c0432a';
const COLOR_NODE_COMMITTED = '#ffe79a';

const COLOR_LABEL_PLATE_FILL = '#2a1c0d';
const COLOR_LABEL_PLATE_STROKE = '#7a5a2c';
const COLOR_LABEL_TEXT_IDLE = '#c9a672';
const COLOR_LABEL_TEXT_ON_PATH = '#ffe7a5';

function nodeByCode(code: string): TreeNode | undefined {
  return TREE_NODES.find((n) => n.code === code);
}

export function MorseTree() {
  const currentCode = useInputStore((s) => s.currentCode);
  const errorCode = useInputStore((s) => s.errorCode);
  const committedCode = useInputStore((s) => s.committedCode);

  const pathCodes = useMemo(() => {
    const codes = new Set<string>(['']);
    for (let i = 1; i <= currentCode.length; i++) {
      codes.add(currentCode.slice(0, i));
    }
    return codes;
  }, [currentCode]);

  return (
    <div
      className="relative h-full w-full"
      style={{
        borderRadius: 6,
        background:
          'radial-gradient(ellipse at center, #3a2a15 0%, #2a1d0d 60%, #1a1208 100%)',
        boxShadow:
          'inset 0 0 0 2px #1a1208, inset 0 0 0 4px #7a5a2c, inset 0 0 22px rgba(0,0,0,0.55), 0 8px 22px rgba(0,0,0,0.6)',
        padding: 6,
      }}
    >
      {/* corner brass brackets */}
      <CornerBracket position="tl" />
      <CornerBracket position="tr" />
      <CornerBracket position="bl" />
      <CornerBracket position="br" />

      <svg
        viewBox={TREE_VIEWBOX}
        className="block h-full w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <filter id="tree-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="0.9" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id="brass-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e6c180" />
            <stop offset="55%" stopColor="#b08d57" />
            <stop offset="100%" stopColor="#7a5a2c" />
          </linearGradient>
          <linearGradient id="brass-fill-bright" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fff1c2" />
            <stop offset="55%" stopColor="#ffd17a" />
            <stop offset="100%" stopColor="#b08d57" />
          </linearGradient>
        </defs>

        {/* edges first (behind nodes/labels) */}
        {TREE_EDGES.map(({ from, to }) => {
          const a = nodeByCode(from);
          const b = nodeByCode(to);
          if (!a || !b) return null;
          const onPath = pathCodes.has(from) && pathCodes.has(to);
          return (
            <line
              key={`${from}->${to}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={onPath ? COLOR_EDGE_ON_PATH : COLOR_EDGE_IDLE}
              strokeWidth={onPath ? 0.9 : 0.4}
              strokeLinecap="round"
              filter={onPath ? 'url(#tree-glow)' : undefined}
              style={{ transition: 'stroke 120ms, stroke-width 120ms' }}
            />
          );
        })}

        {/* antenna at root */}
        <g>
          <rect
            x={ANTENNA.x - 3}
            y={ANTENNA.y - 4}
            width={6}
            height={6}
            rx={0.6}
            fill="url(#brass-fill)"
            stroke={COLOR_NODE_IDLE_STROKE}
            strokeWidth={0.5}
          />
          <line
            x1={ANTENNA.x}
            y1={ANTENNA.y - 4}
            x2={ANTENNA.x}
            y2={ANTENNA.y - 8.5}
            stroke="#c9a672"
            strokeWidth={0.6}
          />
          <circle
            cx={ANTENNA.x}
            cy={ANTENNA.y - 9.2}
            r={0.9}
            fill="url(#brass-fill-bright)"
            stroke={COLOR_NODE_IDLE_STROKE}
            strokeWidth={0.3}
          />
        </g>

        {/* nodes */}
        {TREE_NODES.filter((n) => n.shape !== 'antenna').map((node) => {
          const onPath = pathCodes.has(node.code);
          const isCurrent = currentCode !== '' && node.code === currentCode;
          const isError = errorCode === node.code;
          const isCommitted = committedCode === node.code;

          let fill: string = 'url(#brass-fill)';
          let stroke = COLOR_NODE_IDLE_STROKE;
          let strokeWidth = 0.4;

          if (isError) {
            fill = COLOR_NODE_ERROR;
            stroke = '#3a2a15';
            strokeWidth = 0.7;
          } else if (isCommitted) {
            fill = COLOR_NODE_COMMITTED;
            stroke = '#3a2a15';
            strokeWidth = 0.7;
          } else if (isCurrent) {
            fill = COLOR_NODE_CURRENT_FILL;
            stroke = '#3a2a15';
            strokeWidth = 0.8;
          } else if (onPath) {
            fill = COLOR_NODE_ON_PATH_FILL;
            stroke = '#3a2a15';
            strokeWidth = 0.55;
          }

          const useGlow = onPath || isError || isCommitted || isCurrent;

          return (
            <g
              key={`node-${node.code}`}
              style={{ transition: 'fill 120ms, stroke 120ms' }}
            >
              {node.shape === 'dot' ? (
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={DOT_RADIUS}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                  filter={useGlow ? 'url(#tree-glow)' : undefined}
                />
              ) : (
                <rect
                  x={node.x - DASH_WIDTH / 2}
                  y={node.y - DASH_HEIGHT / 2}
                  width={DASH_WIDTH}
                  height={DASH_HEIGHT}
                  rx={0.8}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                  filter={useGlow ? 'url(#tree-glow)' : undefined}
                />
              )}
            </g>
          );
        })}

        {/* labels rendered last so they sit on top of edges; engraved-plate backdrop hides the line behind them */}
        {TREE_NODES.filter((n) => n.shape !== 'antenna').map((node) => {
          const onPath = pathCodes.has(node.code);
          const labelY = node.y + LABEL_BASELINE_OFFSET;

          return (
            <g key={`label-${node.code}`}>
              <rect
                x={node.x - LABEL_PLATE_W / 2}
                y={labelY - LABEL_PLATE_H + 0.6}
                width={LABEL_PLATE_W}
                height={LABEL_PLATE_H}
                rx={0.6}
                fill={COLOR_LABEL_PLATE_FILL}
                stroke={COLOR_LABEL_PLATE_STROKE}
                strokeWidth={0.25}
              />
              <text
                x={node.x}
                y={labelY}
                textAnchor="middle"
                fontFamily='"Cormorant Garamond", Georgia, serif'
                fontSize={3.6}
                fontWeight={700}
                fill={onPath ? COLOR_LABEL_TEXT_ON_PATH : COLOR_LABEL_TEXT_IDLE}
                style={{ transition: 'fill 120ms' }}
              >
                {node.letter}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function CornerBracket({ position }: { position: 'tl' | 'tr' | 'bl' | 'br' }) {
  const isTop = position[0] === 't';
  const isLeft = position[1] === 'l';
  const style: React.CSSProperties = {
    position: 'absolute',
    width: 14,
    height: 14,
    borderColor: '#c9a672',
    pointerEvents: 'none',
    [isTop ? 'top' : 'bottom']: 4,
    [isLeft ? 'left' : 'right']: 4,
    borderStyle: 'solid',
    borderWidth: 0,
    borderTopWidth: isTop ? 2 : 0,
    borderBottomWidth: !isTop ? 2 : 0,
    borderLeftWidth: isLeft ? 2 : 0,
    borderRightWidth: !isLeft ? 2 : 0,
    borderTopLeftRadius: position === 'tl' ? 4 : 0,
    borderTopRightRadius: position === 'tr' ? 4 : 0,
    borderBottomLeftRadius: position === 'bl' ? 4 : 0,
    borderBottomRightRadius: position === 'br' ? 4 : 0,
    boxShadow: '0 0 4px rgba(201, 166, 114, 0.5)',
  };
  return <div style={style} />;
}
