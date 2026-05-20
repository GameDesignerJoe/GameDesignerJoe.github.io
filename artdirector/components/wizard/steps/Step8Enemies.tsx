'use client';

import StepWrapper from '../StepWrapper';
import CardGrid from '../CardGrid';
import { Field } from '../Field';
import { noEnemies, useWizardStore } from '@/store/wizardStore';
import { ENEMY_NATURES } from '@/lib/wizardData';

export default function Step8Enemies() {
  const s = useWizardStore();
  const showDetail = !!s.enemyNature && !noEnemies(s);
  return (
    <StepWrapper
      step={8}
      label="Enemies"
      title="What does the player face?"
      subtitle={
        <>
          One enemy type is enough to establish design direction. Same DNA as everything else — contrast comes from <strong className="text-text font-semibold">design choices</strong>, not a different rendering style.
        </>
      }
    >
      <Field label="Enemy type">
        <CardGrid
          options={ENEMY_NATURES}
          value={s.enemyNature}
          onChange={(v) => s.set('enemyNature', v)}
          size="wide"
        />
      </Field>

      {showDetail && (
        <Field
          label="Describe one example enemy"
          hint="One concrete enemy establishes the design direction. No need to describe the full roster."
        >
          <textarea
            value={s.enemyDesc}
            onChange={(e) => s.set('enemyDesc', e.target.value)}
            placeholder="e.g. A corrupted soldier fused with alien biomatter — degraded military armor overrun with organic growth, amber glowing eyes, moves in hunched lurching patterns…"
          />
        </Field>
      )}
    </StepWrapper>
  );
}
