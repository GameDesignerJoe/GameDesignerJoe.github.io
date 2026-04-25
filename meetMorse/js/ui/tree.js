import { state } from '../state.js';
import {
  ANTENNA,
  TREE_EDGES,
  TREE_NODES,
  TREE_VIEWBOX,
} from '../data/morseTree.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const DOT_RADIUS = 2.2;
const DASH_WIDTH = 6;
const DASH_HEIGHT = 2.8;
const LABEL_BASELINE_OFFSET = 7.2;
const LABEL_PLATE_W = 4.2;
const LABEL_PLATE_H = 4.4;

const edgeRefs = new Map(); // 'from->to' -> <line>
const nodeRefs = new Map(); // code -> { node, label }

function el(name, attrs = {}) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

function nodeByCode(code) {
  return TREE_NODES.find((n) => n.code === code);
}

export function initTree() {
  const container = document.getElementById('tree-container');
  if (!container) return;

  const svg = el('svg', {
    viewBox: TREE_VIEWBOX,
    preserveAspectRatio: 'xMidYMid meet',
    class: 'tree-svg',
  });

  // <defs> — glow filter + brass gradients. Easiest as innerHTML markup;
  // the browser parses it under the SVG namespace.
  const defs = el('defs');
  defs.innerHTML = `
    <filter id="tree-glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="0.9" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
    <linearGradient id="brass-fill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#e6c180" />
      <stop offset="55%" stop-color="#b08d57" />
      <stop offset="100%" stop-color="#7a5a2c" />
    </linearGradient>
    <linearGradient id="brass-fill-bright" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#fff1c2" />
      <stop offset="55%" stop-color="#ffd17a" />
      <stop offset="100%" stop-color="#b08d57" />
    </linearGradient>
  `;
  svg.appendChild(defs);

  // edges first so they sit behind nodes & label plates
  for (const { from, to } of TREE_EDGES) {
    const a = nodeByCode(from);
    const b = nodeByCode(to);
    if (!a || !b) continue;
    const line = el('line', {
      x1: a.x, y1: a.y, x2: b.x, y2: b.y,
      class: 'tree-edge',
    });
    svg.appendChild(line);
    edgeRefs.set(`${from}->${to}`, line);
  }

  // antenna at root (decorative)
  const antG = el('g');
  antG.appendChild(el('rect', {
    x: ANTENNA.x - 3, y: ANTENNA.y - 4, width: 6, height: 6, rx: 0.6,
    class: 'tree-antenna-rect',
  }));
  antG.appendChild(el('line', {
    x1: ANTENNA.x, y1: ANTENNA.y - 4, x2: ANTENNA.x, y2: ANTENNA.y - 8.5,
    class: 'tree-antenna-line',
  }));
  antG.appendChild(el('circle', {
    cx: ANTENNA.x, cy: ANTENNA.y - 9.2, r: 0.9,
    class: 'tree-antenna-bulb',
  }));
  svg.appendChild(antG);

  // letter nodes
  for (const node of TREE_NODES) {
    if (node.shape === 'antenna') continue;
    let shapeEl;
    if (node.shape === 'dot') {
      shapeEl = el('circle', {
        cx: node.x, cy: node.y, r: DOT_RADIUS, class: 'tree-node',
      });
    } else {
      shapeEl = el('rect', {
        x: node.x - DASH_WIDTH / 2,
        y: node.y - DASH_HEIGHT / 2,
        width: DASH_WIDTH,
        height: DASH_HEIGHT,
        rx: 0.8,
        class: 'tree-node',
      });
    }
    svg.appendChild(shapeEl);

    // engraved label plate + text on top so they mask the edge below
    const labelY = node.y + LABEL_BASELINE_OFFSET;
    svg.appendChild(el('rect', {
      x: node.x - LABEL_PLATE_W / 2,
      y: labelY - LABEL_PLATE_H + 0.6,
      width: LABEL_PLATE_W,
      height: LABEL_PLATE_H,
      rx: 0.6,
      class: 'tree-label-plate',
    }));
    const text = el('text', {
      x: node.x, y: labelY,
      class: 'tree-label-text',
    });
    text.textContent = node.letter;
    svg.appendChild(text);

    nodeRefs.set(node.code, { node: shapeEl, label: text });
  }

  container.appendChild(svg);

  // brass corner brackets (HTML, not SVG)
  for (const corner of ['tl', 'tr', 'bl', 'br']) {
    const div = document.createElement('div');
    div.className = `corner-bracket ${corner}`;
    container.appendChild(div);
  }

  renderTree();
}

export function renderTree() {
  const { currentCode, errorCode, committedCode, hintTarget } = state;
  const pathCodes = new Set(['']);
  for (let i = 1; i <= currentCode.length; i++) {
    pathCodes.add(currentCode.slice(0, i));
  }
  // codes along the hint trail (root → hintTarget). Empty when no hint.
  const hintCodes = new Set();
  if (hintTarget) {
    hintCodes.add('');
    for (let i = 1; i <= hintTarget.length; i++) {
      hintCodes.add(hintTarget.slice(0, i));
    }
  }

  for (const [key, line] of edgeRefs) {
    const [from, to] = key.split('->');
    const onPath = pathCodes.has(from) && pathCodes.has(to);
    const onHint = hintCodes.has(from) && hintCodes.has(to);
    line.classList.toggle('on-path', onPath);
    line.classList.toggle('hint', onHint && !onPath);
  }

  for (const [code, refs] of nodeRefs) {
    const onPath = pathCodes.has(code);
    const isCurrent = currentCode !== '' && code === currentCode;
    const isError = code === errorCode;
    const isCommitted = code === committedCode;
    const isHint = hintCodes.has(code);

    refs.node.classList.toggle('on-path', onPath && !isCurrent && !isError && !isCommitted);
    refs.node.classList.toggle('current', isCurrent && !isError && !isCommitted);
    refs.node.classList.toggle('error', isError);
    refs.node.classList.toggle('committed', isCommitted);
    refs.node.classList.toggle('hint', isHint && !onPath && !isError && !isCommitted);

    refs.label.classList.toggle('on-path', onPath || isHint);
  }
}
