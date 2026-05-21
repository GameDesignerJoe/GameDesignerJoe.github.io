import type { WizardState } from '@/types';
import { DNA_SPECTRUM } from './dnaData';

export type ScopeTier = 'indie' | 'mid' | 'aaa';

export interface QuadrantGame {
  name: string;
  /** [x: abstract(0) -> realistic(100), y: dark(0) -> bright(100)] */
  pos: [number, number];
  scope: ScopeTier;
}

/**
 * Reference games plotted on the 2D style space.
 * X: 0 (abstract / minimalist) -> 100 (photorealistic / cinematic)
 * Y: 0 (dark / grim) -> 100 (bright / vibrant)
 */
export const GAME_POSITIONS: QuadrantGame[] = [
  { name: 'Journey', pos: [20, 75], scope: 'indie' },
  { name: 'Gris', pos: [15, 70], scope: 'indie' },
  { name: 'Limbo', pos: [25, 15], scope: 'indie' },
  { name: 'Inside', pos: [30, 20], scope: 'indie' },
  { name: 'Transistor', pos: [35, 45], scope: 'indie' },
  { name: 'Hollow Knight', pos: [40, 30], scope: 'indie' },
  { name: 'Hades', pos: [45, 55], scope: 'indie' },
  { name: 'Cuphead', pos: [30, 80], scope: 'indie' },
  { name: 'Ori', pos: [35, 85], scope: 'mid' },
  { name: 'Dead Cells', pos: [50, 35], scope: 'indie' },
  { name: 'Disco Elysium', pos: [55, 45], scope: 'indie' },
  { name: 'Firewatch', pos: [65, 65], scope: 'indie' },
  { name: 'Outer Wilds', pos: [70, 75], scope: 'indie' },
  { name: 'Stray', pos: [75, 60], scope: 'mid' },
  { name: 'Hi-Fi Rush', pos: [60, 82], scope: 'mid' },
  { name: 'Kena', pos: [72, 78], scope: 'mid' },
  { name: 'Dishonored 2', pos: [68, 45], scope: 'aaa' },
  { name: 'Hellblade', pos: [80, 20], scope: 'mid' },
  { name: 'A Plague Tale', pos: [75, 30], scope: 'mid' },
  { name: 'God of War', pos: [85, 40], scope: 'aaa' },
  { name: 'Ghost of Tsushima', pos: [88, 72], scope: 'aaa' },
  { name: 'The Last of Us II', pos: [90, 25], scope: 'aaa' },
  { name: 'Returnal', pos: [82, 35], scope: 'aaa' },
];

export interface Position {
  x: number;
  y: number;
}

const DARK_TONE_HINTS = ['dark', 'tense', 'eerie'];
const BRIGHT_TONE_HINTS = ['hopeful', 'stylish', 'epic'];
const DARK_COLOR_HINTS = ['dark', 'muted'];
const BRIGHT_COLOR_HINTS = ['bold', 'natural', 'neon'];

function any(s: string, hints: string[]): boolean {
  const lower = s.toLowerCase();
  return hints.some((h) => lower.includes(h));
}

/**
 * Derive a quadrant position from the current wizard state.
 * X comes from the DNA's authored quadrantX.
 * Y averages tone-derived and color-derived scores so each pulls the position somewhat.
 */
export function calculateQuadrantPosition(state: WizardState): Position {
  // X: DNA -> abstract..realistic
  const dna = DNA_SPECTRUM.find((d) => d.name === state.dnaName);
  const x = dna ? dna.quadrantX : 50;

  // Y: tone + color combined
  let toneScore = 50;
  if (state.tone) {
    if (any(state.tone, DARK_TONE_HINTS)) toneScore = 25;
    else if (any(state.tone, BRIGHT_TONE_HINTS)) toneScore = 75;
  }
  let colorScore = 50;
  if (state.colorMood) {
    if (any(state.colorMood, DARK_COLOR_HINTS)) colorScore = 25;
    else if (any(state.colorMood, BRIGHT_COLOR_HINTS)) colorScore = 75;
  }
  const y = (toneScore + colorScore) / 2;
  return { x, y };
}

export function clampPosition(p: Position): Position {
  return {
    x: Math.min(100, Math.max(0, p.x)),
    y: Math.min(100, Math.max(0, p.y)),
  };
}

export const ZONE_LABELS = {
  topLeft: 'Dreamlike / Whimsical',
  topRight: 'Vibrant Realism',
  bottomLeft: 'Stark / Geometric',
  bottomRight: 'Gritty Realism',
};
