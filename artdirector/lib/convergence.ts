import type { WizardState } from '@/types';

export interface Bounds {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export type Position = [number, number];

export interface ConvergenceRound {
  optionA: { position: Position; prompt: string };
  optionB: { position: Position; prompt: string };
  chosen?: 'A' | 'B';
}

/** How many rounds the flow runs before locking in the final position. */
export const TOTAL_ROUNDS = 4;

export const FULL_BOUNDS: Bounds = { xMin: 0, xMax: 100, yMin: 0, yMax: 100 };

/**
 * Pick two well-separated positions inside the current bounds. We sample at the
 * 1/3 and 2/3 points along the diagonal so the two options always sit on
 * opposite sides — maximizing discriminative value per pick.
 */
export function getNextCandidates(bounds: Bounds): [Position, Position] {
  const xRange = bounds.xMax - bounds.xMin;
  const yRange = bounds.yMax - bounds.yMin;
  return [
    [bounds.xMin + xRange * 0.33, bounds.yMin + yRange * 0.33],
    [bounds.xMin + xRange * 0.67, bounds.yMin + yRange * 0.67],
  ];
}

/**
 * After a pick, contract bounds toward the winner. We don't fully clamp to
 * that quadrant — we keep a ±40% radius around the winner so neighbouring
 * options remain reachable in later rounds.
 */
export function updateBounds(
  current: Bounds,
  chosen: 'A' | 'B',
  posA: Position,
  posB: Position
): Bounds {
  const [wx, wy] = chosen === 'A' ? posA : posB;
  const xRadius = (current.xMax - current.xMin) * 0.4;
  const yRadius = (current.yMax - current.yMin) * 0.4;
  return {
    xMin: Math.max(0, wx - xRadius),
    xMax: Math.min(100, wx + xRadius),
    yMin: Math.max(0, wy - yRadius),
    yMax: Math.min(100, wy + yRadius),
  };
}

export function boundsCenter(b: Bounds): Position {
  return [(b.xMin + b.xMax) / 2, (b.yMin + b.yMax) / 2];
}

/**
 * Build a neutral environment-shot prompt for the convergence flow.
 * We use environments (no characters) so the user is judging style, not subject.
 */
export function buildConvergencePrompt(position: Position, base: WizardState): string {
  const [x, y] = position;

  const renderStyle =
    x < 33
      ? 'minimalist geometric flat design, abstract shapes, silhouette-driven, severely limited palette'
      : x < 66
      ? 'stylized painterly game art, expressive brushstroke quality, concept art aesthetic, slightly pushed proportions'
      : 'photorealistic game art, physically-based rendering, cinematic realism, hyper-detailed surfaces, film quality';

  const atmosphere =
    y < 33
      ? 'dark gritty moody, desaturated palette, heavy shadows, oppressive atmosphere'
      : y < 66
      ? 'balanced atmospheric tone, moderate saturation, dramatic lighting'
      : 'bright vibrant hopeful, saturated warm colors, uplifting atmosphere';

  const settingHint = base.setting ? `${base.setting} game world` : 'game world environment';
  const genreHint = base.genre ? `, ${base.genre}` : '';

  return `game concept art environment, ${renderStyle}, ${atmosphere}, ${settingHint}${genreHint}, wide establishing shot, no characters in frame, atmospheric depth, professional game art, no text, no watermark, no UI`;
}
