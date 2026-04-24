export const CODE_TO_LETTER: Record<string, string> = {
  '.': 'E',    '-': 'T',
  '..': 'I',   '.-': 'A',   '-.': 'N',   '--': 'M',
  '...': 'S',  '..-': 'U',  '.-.': 'R',  '.--': 'W',
  '-..': 'D',  '-.-': 'K',  '--.': 'G',  '---': 'O',
  '....': 'H', '...-': 'V', '..-.': 'F', '.-..': 'L',
  '.--.': 'P', '.---': 'J', '-...': 'B', '-..-': 'X',
  '-.-.': 'C', '-.--': 'Y', '--..': 'Z', '--.-': 'Q',
};

export const LETTER_TO_CODE: Record<string, string> = Object.fromEntries(
  Object.entries(CODE_TO_LETTER).map(([code, letter]) => [letter, code]),
);

export type NodeShape = 'antenna' | 'dot' | 'dash';

export interface TreeNode {
  code: string;
  letter: string | null;
  x: number;
  y: number;
  shape: NodeShape;
}

const VIEW_WIDTH = 100;
const VIEW_HEIGHT = 140;
const Y_BY_LEVEL = [15, 40, 65, 95, 125];
const STEP_BY_LEVEL = [22, 11, 5.5, 2.75];

function positionForCode(code: string): { x: number; y: number } {
  let x = VIEW_WIDTH / 2;
  for (let i = 0; i < code.length; i++) {
    const direction = code[i] === '.' ? 1 : -1;
    x += direction * STEP_BY_LEVEL[i];
  }
  const y = Y_BY_LEVEL[code.length];
  return { x, y };
}

export const ANTENNA: TreeNode = {
  code: '',
  letter: null,
  shape: 'antenna',
  ...positionForCode(''),
};

export const TREE_NODES: TreeNode[] = [
  ANTENNA,
  ...Object.entries(CODE_TO_LETTER).map(([code, letter]) => {
    const { x, y } = positionForCode(code);
    const lastSymbol = code[code.length - 1];
    const shape: NodeShape = lastSymbol === '.' ? 'dot' : 'dash';
    return { code, letter, x, y, shape };
  }),
];

export const TREE_EDGES: Array<{ from: string; to: string }> = Object.keys(
  CODE_TO_LETTER,
).map((code) => ({
  from: code.slice(0, -1),
  to: code,
}));

export const TREE_VIEWBOX = `0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`;
