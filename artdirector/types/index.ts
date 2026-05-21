export interface WizardState {
  gameTitle: string;
  genre: string;
  platform: string;
  cameraType: string;
  dimension: string;
  scope: string;

  tone: string;
  worldFeel: string;
  pacing: string;

  dna: string;
  dnaName: string;

  shapeLanguage: string;
  colorMood: string;
  lighting: string;
  detailDensity: string;

  referenceGames: string[];
  nonGame: string;
  antiRef: string;

  setting: string;
  archStyle: string;
  envDesc1: string;
  envDesc2: string;
  envDesc3: string;

  bodyProp: string;
  costumeComp: string;
  charDesc: string;
  handsDesc: string;

  enemyNature: string;
  enemyDesc: string;

  equipAesthetic: string;
  singleProp: string;

  fontStyle: string;
  uiStyle: string;
  uiDesc: string;

  // Phase 2+ extended state (kept here so the store schema is stable from day 1)
  quadrantPosition: { x: number; y: number };
  /** True once the user has dragged the dot, suppressing further auto-position from DNA/tone. */
  quadrantManual: boolean;
  generatedImages: Record<string, string>;
  styleConfirmed: boolean;
}

export interface OptionCard {
  v: string;
  icon?: string;
  title: string;
  desc?: string;
}

export interface DNAOption {
  name: string;
  v: string;
  desc: string;
  tags: string[];
  cross: string;
  quadrantX: number;
}

export interface GameRef {
  n: string;
  q: string;
  scope: 'indie' | 'mid' | 'aaa';
}

export type ImageRatio = 'landscape_16_9' | 'square_hd' | 'portrait_4_3';
export type ImageQuality = 'fast' | 'quality';

export interface PromptCardData {
  id: string;
  num: number;
  icon: string;
  name: string;
  description: string;
  prompt: string;
  badge: string;
  ratio: string;
  ratioKey: ImageRatio;
  refUrl: string;
}
