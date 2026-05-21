'use client';

import StepWrapper from '../StepWrapper';
import GameChips from '../GameChips';
import { Divider, Field } from '../Field';
import { useWizardStore } from '@/store/wizardStore';

export default function Step5References() {
  const s = useWizardStore();
  return (
    <StepWrapper
      title="Build your mood board"
      subtitle={
        <>
          Games within your chosen DNA only. Scope badges show production scale — separating tonal references from realistic targets.
        </>
      }
    >
      <GameChips />

      <Divider />

      <Field label="Other inspirations — films, art, animation, artists">
        <input
          type="text"
          value={s.nonGame}
          onChange={(e) => s.set('nonGame', e.target.value)}
          placeholder="e.g. Blade Runner 2049, Moebius, Caravaggio, brutalist architecture…"
        />
      </Field>

      <Field label="Styles you want to avoid">
        <input
          type="text"
          value={s.antiRef}
          onChange={(e) => s.set('antiRef', e.target.value)}
          placeholder="e.g. Fortnite cartoon look, generic brown-and-gray realism…"
        />
      </Field>
    </StepWrapper>
  );
}
