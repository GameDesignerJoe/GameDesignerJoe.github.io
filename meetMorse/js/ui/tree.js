import { state } from '../state.js';
import {
  ANTENNA,
  TREE_EDGES,
  TREE_NODES,
  TREE_VIEWBOX,
  LETTER_TO_CODE,
} from '../data/morseTree.js';
import { getMode } from '../modes/index.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const DOT_RADIUS = 2.6;
const DASH_WIDTH = 7;
const DASH_HEIGHT = 3.2;
const LABEL_BASELINE_OFFSET = 7;
const LABEL_PLATE_W = 5.2;
const LABEL_PLATE_H = 5.2;
const LABEL_FONT_SIZE = 4;

const edgeRefs = new Map(); // 'from->to' -> <line>
const nodeRefs = new Map(); // code -> { node, plate, label }

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
    preserveAspectRatio: 'xMidYMin meet',
    class: 'tree-svg',
  });

  const defs = el('defs');
  defs.innerHTML = `
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

  // edges first so they sit behind nodes & plates
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

  // antenna decoration
  const antG = el('g');
  antG.appendChild(el('rect', {
    x: ANTENNA.x - 3.5, y: ANTENNA.y - 4.5, width: 7, height: 7, rx: 0.7,
    class: 'tree-antenna-rect',
  }));
  antG.appendChild(el('line', {
    x1: ANTENNA.x, y1: ANTENNA.y - 4.5, x2: ANTENNA.x, y2: ANTENNA.y - 9,
    class: 'tree-antenna-line',
  }));
  antG.appendChild(el('circle', {
    cx: ANTENNA.x, cy: ANTENNA.y - 9.8, r: 1.1,
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
        rx: 1,
        class: 'tree-node',
      });
    }
    svg.appendChild(shapeEl);

    const labelY = node.y + LABEL_BASELINE_OFFSET;
    const plate = el('rect', {
      x: node.x - LABEL_PLATE_W / 2,
      y: labelY - LABEL_PLATE_H + 0.8,
      width: LABEL_PLATE_W,
      height: LABEL_PLATE_H,
      rx: 0.7,
      class: 'tree-label-plate',
    });
    svg.appendChild(plate);

    const text = el('text', {
      x: node.x,
      y: labelY,
      'font-size': LABEL_FONT_SIZE,
      class: 'tree-label-text',
    });
    text.textContent = node.letter;
    svg.appendChild(text);

    nodeRefs.set(node.code, { node: shapeEl, plate, label: text });
  }

  container.appendChild(svg);

  for (const corner of ['tl', 'tr', 'bl', 'br']) {
    const div = document.createElement('div');
    div.className = `corner-bracket ${corner}`;
    container.appendChild(div);
  }

  renderTree();
}

// Codes that should remain visible in focus mode: every code on the path
// from antenna to each letter of the current word.
function computeFocusCodes() {
  const mode = getMode(state.mode);
  if (!mode.focusOnTargetWord || !state.currentWord) return null;
  const codes = new Set(['']);
  for (const letter of state.currentWord) {
    const code = LETTER_TO_CODE[letter];
    if (!code) continue;
    for (let i = 1; i <= code.length; i++) codes.add(code.slice(0, i));
  }
  return codes;
}

export function renderTree() {
  const { currentCode, errorCode, committedCode, hintTarget } = state;
  const pathCodes = new Set(['']);
  for (let i = 1; i <= currentCode.length; i++) {
    pathCodes.add(currentCode.slice(0, i));
  }
  const hintCodes = new Set();
  if (hintTarget) {
    hintCodes.add('');
    for (let i = 1; i <= hintTarget.length; i++) {
      hintCodes.add(hintTarget.slice(0, i));
    }
  }
  const focusCodes = computeFocusCodes();

  for (const [key, line] of edgeRefs) {
    const [from, to] = key.split('->');
    const onPath = pathCodes.has(from) && pathCodes.has(to);
    const onHint = hintCodes.has(from) && hintCodes.has(to);
    const dimmed = focusCodes
      ? !(focusCodes.has(from) && focusCodes.has(to))
      : false;
    line.classList.toggle('on-path', onPath && !dimmed);
    line.classList.toggle('hint', onHint && !onPath && !dimmed);
    line.classList.toggle('dimmed', dimmed);
  }

  for (const [code, refs] of nodeRefs) {
    const onPath = pathCodes.has(code);
    const isCurrent = currentCode !== '' && code === currentCode;
    const isError = code === errorCode;
    const isCommitted = code === committedCode;
    const isHint = hintCodes.has(code);
    const dimmed = focusCodes ? !focusCodes.has(code) : false;

    refs.node.classList.toggle('on-path', onPath && !isCurrent && !isError && !isCommitted && !dimmed);
    refs.node.classList.toggle('current', isCurrent && !isError && !isCommitted && !dimmed);
    refs.node.classList.toggle('error', isError);
    refs.node.classList.toggle('committed', isCommitted);
    refs.node.classList.toggle('hint', isHint && !onPath && !isError && !isCommitted && !dimmed);
    refs.node.classList.toggle('dimmed', dimmed && !isError && !isCommitted);

    refs.plate.classList.toggle('dimmed', dimmed && !isError && !isCommitted);
    refs.label.classList.toggle('on-path', (onPath || isHint) && !dimmed);
    refs.label.classList.toggle('dimmed', dimmed && !isError && !isCommitted);
  }
}
