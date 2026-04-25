export const CODE_TO_LETTER = {
  '.': 'E',    '-': 'T',
  '..': 'I',   '.-': 'A',   '-.': 'N',   '--': 'M',
  '...': 'S',  '..-': 'U',  '.-.': 'R',  '.--': 'W',
  '-..': 'D',  '-.-': 'K',  '--.': 'G',  '---': 'O',
  '....': 'H', '...-': 'V', '..-.': 'F', '.-..': 'L',
  '.--.': 'P', '.---': 'J', '-...': 'B', '-..-': 'X',
  '-.-.': 'C', '-.--': 'Y', '--..': 'Z', '--.-': 'Q',
};

export const LETTER_TO_CODE = Object.fromEntries(
  Object.entries(CODE_TO_LETTER).map(([code, letter]) => [letter, code]),
);

const VIEW_WIDTH = 160;
const VIEW_HEIGHT = 110;
const Y_BY_LEVEL = [12, 32, 52, 73, 94];
const STEP_BY_LEVEL = [40, 20, 10, 5];

function positionForCode(code) {
  let x = VIEW_WIDTH / 2;
  for (let i = 0; i < code.length; i++) {
    const direction = code[i] === '.' ? 1 : -1;
    x += direction * STEP_BY_LEVEL[i];
  }
  return { x, y: Y_BY_LEVEL[code.length] };
}

export const ANTENNA = {
  code: '',
  letter: null,
  shape: 'antenna',
  ...positionForCode(''),
};

export const TREE_NODES = [
  ANTENNA,
  ...Object.entries(CODE_TO_LETTER).map(([code, letter]) => {
    const { x, y } = positionForCode(code);
    const last = code[code.length - 1];
    return { code, letter, x, y, shape: last === '.' ? 'dot' : 'dash' };
  }),
];

export const TREE_EDGES = Object.keys(CODE_TO_LETTER).map((code) => ({
  from: code.slice(0, -1),
  to: code,
}));

export const TREE_VIEWBOX = `0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`;
