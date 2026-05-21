import type { ComponentType } from 'react';
import Identity from './Step1Identity';
import Tone from './Step2Tone';
import DNA from './Step3DNA';
import Quadrant from './Step4Quadrant';
import Rules from './Step4Rules';
import References from './Step5References';
import Environments from './Step6Environments';
import Characters from './Step7Characters';
import Enemies from './Step8Enemies';
import Props from './Step9Props';
import TitleUI from './Step10TitleUI';

/**
 * Step identity is the `id` field — file names are historical and don't track
 * URL position. The order of this array determines URL position (1-indexed).
 */
export type StepId =
  | 'identity'
  | 'tone'
  | 'dna'
  | 'quadrant'
  | 'rules'
  | 'references'
  | 'environments'
  | 'characters'
  | 'enemies'
  | 'props'
  | 'titleui';

export interface StepMeta {
  id: StepId;
  label: string;
  component: ComponentType;
}

export const STEPS: StepMeta[] = [
  { id: 'identity', label: 'Project Identity', component: Identity },
  { id: 'tone', label: 'Core Tone', component: Tone },
  { id: 'dna', label: 'Visual DNA (most important)', component: DNA },
  { id: 'quadrant', label: 'Style Quadrant', component: Quadrant },
  { id: 'rules', label: 'Visual Rules', component: Rules },
  { id: 'references', label: 'Visual References', component: References },
  { id: 'environments', label: 'Environments', component: Environments },
  { id: 'characters', label: 'Player Characters', component: Characters },
  { id: 'enemies', label: 'Enemies', component: Enemies },
  { id: 'props', label: 'Equipment & Props', component: Props },
  { id: 'titleui', label: 'Title & UI', component: TitleUI },
];

export const TOTAL_STEPS = STEPS.length;

export function getStepMeta(n: number): StepMeta | undefined {
  return STEPS[n - 1];
}

export function stepIdAt(n: number): StepId | null {
  const meta = getStepMeta(n);
  return meta ? meta.id : null;
}

export function indexOfStep(id: StepId): number {
  return STEPS.findIndex((s) => s.id === id) + 1;
}
