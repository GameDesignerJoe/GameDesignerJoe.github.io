'use client';

import StepWrapper from '../StepWrapper';
import CardGrid from '../CardGrid';
import { Divider, Field } from '../Field';
import { useWizardStore } from '@/store/wizardStore';
import {
  COLOR_MOODS,
  DETAIL_DENSITIES,
  LIGHTINGS,
  SHAPE_LANGUAGES,
} from '@/lib/wizardData';
import { DNA_COHERENCE } from '@/lib/dnaData';

export default function Step4Rules() {
  const s = useWizardStore();
  const coherence = s.dnaName ? DNA_COHERENCE[s.dnaName] : null;
  const [first, ...rest] = coherence ? coherence.split('. ') : [];

  return (
    <StepWrapper
      title="Lock the specific rules"
      subtitle={
        <>
          These apply across <strong className="text-text font-semibold">all</strong> asset types. Think of them as constraints that can never be violated.
        </>
      }
    >
      {coherence && (
        <div className="bg-accent/10 border border-accent/30 rounded-lg px-3 py-2.5 text-[12px] text-text mb-5 leading-[1.55]">
          <strong className="font-semibold">{first}.</strong> {rest.join('. ')}
        </div>
      )}

      <Field label="Shape language">
        <CardGrid options={SHAPE_LANGUAGES} value={s.shapeLanguage} onChange={(v) => s.set('shapeLanguage', v)} size="sm" />
      </Field>

      <Divider />

      <Field label="Color philosophy">
        <CardGrid options={COLOR_MOODS} value={s.colorMood} onChange={(v) => s.set('colorMood', v)} />
      </Field>

      <Divider />

      <Field label="Dominant lighting mood">
        <CardGrid options={LIGHTINGS} value={s.lighting} onChange={(v) => s.set('lighting', v)} />
      </Field>

      <Divider />

      <Field label="Detail density">
        <CardGrid options={DETAIL_DENSITIES} value={s.detailDensity} onChange={(v) => s.set('detailDensity', v)} size="sm" />
      </Field>
    </StepWrapper>
  );
}
