'use client';

import StepWrapper from '../StepWrapper';
import CardGrid from '../CardGrid';
import { Divider, Field } from '../Field';
import { useWizardStore } from '@/store/wizardStore';
import { FONT_STYLES, UI_STYLES } from '@/lib/wizardData';

export default function Step10TitleUI() {
  const s = useWizardStore();
  return (
    <StepWrapper
      step={10}
      label="Title & UI"
      title="Presentation layer"
      subtitle={
        <>
          A logo treatment for your pitch deck header bar, and a UI mockup showing how the game talks to players.
        </>
      }
    >
      <Field label="Logo and title typography style">
        <CardGrid options={FONT_STYLES} value={s.fontStyle} onChange={(v) => s.set('fontStyle', v)} />
      </Field>

      <Divider />

      <Field label="UI and HUD aesthetic">
        <CardGrid options={UI_STYLES} value={s.uiStyle} onChange={(v) => s.set('uiStyle', v)} size="wide" />
      </Field>

      <Field label="Any specific UI elements or notes">
        <input
          type="text"
          value={s.uiDesc}
          onChange={(e) => s.set('uiDesc', e.target.value)}
          placeholder="e.g. Health shown as a biological monitor, inventory is holographic, compass embedded in the wrist…"
        />
      </Field>
    </StepWrapper>
  );
}
