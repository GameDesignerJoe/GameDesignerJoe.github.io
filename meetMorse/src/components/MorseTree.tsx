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

const COLOR_IDLE_STROKE = 'rgba(223, 233, 248, 0.35)';
const COLOR_IDLE_FILL = 'rgba(16, 28, 46, 1)';
const COLOR_ON_PATH = '#34d399';
const COLOR_CURRENT = '#a7f3d0';
const COLOR_ERROR = '#ef4444';
const COLOR_COMMITTED = '#86efac';
const COLOR_LABEL_IDLE = 'rgba(220, 230, 248, 0.55)';
const COLOR_LABEL_ON_PATH = '#e6fff2';
const COLOR_EDGE_IDLE = 'rgba(223, 233, 248, 0.22)';
const COLOR_EDGE_ON_PATH = '#34d399';

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
      className="w-full max-w-[28rem] rounded-md border overflow-hidden"
      style={{
        borderColor: 'rgba(176, 141, 87, 0.45)',
        background:
          'radial-gradient(ellipse at center, #132036 0%, #0a1322 70%, #070d18 100%)',
        boxShadow:
          'inset 0 0 0 1px rgba(0,0,0,0.5), 0 8px 22px rgba(0,0,0,0.55)',
      }}
    >
      <svg
        viewBox={TREE_VIEWBOX}
        className="block h-auto w-full"
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
        </defs>

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
              strokeWidth={onPath ? 0.9 : 0.35}
              strokeLinecap="round"
              filter={onPath ? 'url(#tree-glow)' : undefined}
              style={{ transition: 'stroke 120ms, stroke-width 120ms' }}
            />
          );
        })}

        <g>
          <rect
            x={ANTENNA.x - 3}
            y={ANTENNA.y - 4}
            width={6}
            height={6}
            rx={0.6}
            fill={COLOR_IDLE_FILL}
            stroke={COLOR_IDLE_STROKE}
            strokeWidth={0.5}
          />
          <line
            x1={ANTENNA.x}
            y1={ANTENNA.y - 4}
            x2={ANTENNA.x}
            y2={ANTENNA.y - 8}
            stroke={COLOR_IDLE_STROKE}
            strokeWidth={0.5}
          />
          <circle
            cx={ANTENNA.x}
            cy={ANTENNA.y - 8.6}
            r={0.7}
            fill={COLOR_IDLE_STROKE}
          />
        </g>

        {TREE_NODES.filter((n) => n.shape !== 'antenna').map((node) => {
          const onPath = pathCodes.has(node.code);
          const isCurrent =
            currentCode !== '' && node.code === currentCode;
          const isError = errorCode === node.code;
          const isCommitted = committedCode === node.code;

          let fill = COLOR_IDLE_FILL;
          let stroke = COLOR_IDLE_STROKE;
          let strokeWidth = 0.4;

          if (isError) {
            fill = COLOR_ERROR;
            stroke = COLOR_ERROR;
            strokeWidth = 0.8;
          } else if (isCommitted) {
            fill = COLOR_COMMITTED;
            stroke = COLOR_COMMITTED;
            strokeWidth = 0.8;
          } else if (isCurrent) {
            fill = COLOR_CURRENT;
            stroke = COLOR_CURRENT;
            strokeWidth = 0.8;
          } else if (onPath) {
            fill = COLOR_ON_PATH;
            stroke = COLOR_ON_PATH;
            strokeWidth = 0.6;
          }

          const labelY = node.y + (node.shape === 'dot' ? 5.2 : 5.8);
          const labelColor = onPath ? COLOR_LABEL_ON_PATH : COLOR_LABEL_IDLE;

          return (
            <g
              key={node.code}
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
                  filter={onPath || isError || isCommitted ? 'url(#tree-glow)' : undefined}
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
                  filter={onPath || isError || isCommitted ? 'url(#tree-glow)' : undefined}
                />
              )}
              <text
                x={node.x}
                y={labelY}
                textAnchor="middle"
                fontFamily='"Public Sans", system-ui, sans-serif'
                fontSize={2.6}
                fontWeight={600}
                fill={labelColor}
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
