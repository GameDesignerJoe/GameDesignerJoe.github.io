'use client';

import StepWrapper from '../StepWrapper';
import CardGrid from '../CardGrid';
import { Divider, Field } from '../Field';
import { useWizardStore } from '@/store/wizardStore';
import { PACINGS, TONES, WORLD_FEELS } from '@/lib/wizardData';

export default function Step2Tone() {
  const s = useWizardStore();
  return (
    <StepWrapper
      title="How should it feel?"
      subtitle={
        <>
          Tone is the most important constraint. A well-matched art style <strong className="text-text font-semibold">amplifies</strong> your game&apos;s emotion — a mismatched one fights it.
        </>
      }
    >
      <Field label="Primary emotional tone">
        <CardGrid options={TONES} value={s.tone} onChange={(v) => s.set('tone', v)} size="wide" />
      </Field>

      <Divider />

      <Field label="The world feels…">
        <CardGrid options={WORLD_FEELS} value={s.worldFeel} onChange={(v) => s.set('worldFeel', v)} size="sm" />
      </Field>

      <Divider />

      <Field label="Pacing feel">
        <CardGrid options={PACINGS} value={s.pacing} onChange={(v) => s.set('pacing', v)} size="sm" />
      </Field>
    </StepWrapper>
  );
}
