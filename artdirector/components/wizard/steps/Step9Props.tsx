'use client';

import StepWrapper from '../StepWrapper';
import CardGrid from '../CardGrid';
import { Field } from '../Field';
import { useWizardStore } from '@/store/wizardStore';
import { EQUIP_AESTHETICS } from '@/lib/wizardData';

export default function Step9Props() {
  const s = useWizardStore();
  return (
    <StepWrapper
      step={9}
      label="Equipment & Props"
      title="What does the world contain?"
      subtitle={
        <>
          A single prop and the equipment aesthetic is enough to establish design language for all world objects.
        </>
      }
    >
      <Field label="Equipment aesthetic">
        <CardGrid
          options={EQUIP_AESTHETICS}
          value={s.equipAesthetic}
          onChange={(v) => s.set('equipAesthetic', v)}
          size="wide"
        />
      </Field>

      <Field
        label="Describe one key prop in this world"
        hint="One specific concrete prop tells more than a list of generic items."
      >
        <input
          type="text"
          value={s.singleProp}
          onChange={(e) => s.set('singleProp', e.target.value)}
          placeholder="e.g. An alien data terminal grown from organic material, pulsing with amber light, interface made of living tissue…"
        />
      </Field>
    </StepWrapper>
  );
}
