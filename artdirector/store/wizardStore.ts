'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { WizardState } from '@/types';

const initialState: WizardState = {
  gameTitle: '',
  genre: '',
  platform: '',
  cameraType: '',
  dimension: '',
  scope: '',
  tone: '',
  worldFeel: '',
  pacing: '',
  dna: '',
  dnaName: '',
  shapeLanguage: '',
  colorMood: '',
  lighting: '',
  detailDensity: '',
  referenceGames: [],
  nonGame: '',
  antiRef: '',
  setting: '',
  archStyle: '',
  envDesc1: '',
  envDesc2: '',
  envDesc3: '',
  bodyProp: '',
  costumeComp: '',
  charDesc: '',
  handsDesc: '',
  enemyNature: '',
  enemyDesc: '',
  equipAesthetic: '',
  singleProp: '',
  fontStyle: '',
  uiStyle: '',
  uiDesc: '',
  quadrantPosition: { x: 50, y: 50 },
  generatedImages: {},
  styleConfirmed: false,
};

interface WizardStore extends WizardState {
  set: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void;
  setDNA: (name: string, v: string) => void;
  toggleReferenceGame: (name: string) => void;
  reset: () => void;
}

export const useWizardStore = create<WizardStore>()(
  persist(
    (set) => ({
      ...initialState,
      set: (key, value) => set({ [key]: value } as Partial<WizardState>),
      setDNA: (name, v) => set({ dnaName: name, dna: v }),
      toggleReferenceGame: (name) =>
        set((s) => ({
          referenceGames: s.referenceGames.includes(name)
            ? s.referenceGames.filter((g) => g !== name)
            : [...s.referenceGames, name],
        })),
      reset: () => set({ ...initialState }),
    }),
    {
      name: 'art-style-compass-v2',
      version: 1,
      // Defer reading localStorage until after the first client render so SSR/CSR markup matches.
      skipHydration: true,
    }
  )
);

export const isFP = (s: WizardState) =>
  !!s.cameraType && s.cameraType.includes('first-person');
export const noEnemies = (s: WizardState) =>
  !!s.enemyNature && s.enemyNature.includes('no enemies');
export const noWeapons = (s: WizardState) =>
  !!s.equipAesthetic && s.equipAesthetic.includes('no weapons');

export function getScopeKey(s: WizardState): 'indie' | 'mid' | 'aaa' | '' {
  if (s.scope.includes('indie') || s.scope.includes('artful')) return 'indie';
  if (s.scope.includes('mid') || s.scope.includes('focused')) return 'mid';
  if (s.scope.includes('AAA') || s.scope.includes('full')) return 'aaa';
  return '';
}
