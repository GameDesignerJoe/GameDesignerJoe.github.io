'use client';

import StepWrapper from '../StepWrapper';
import CardGrid from '../CardGrid';
import { Divider, Field } from '../Field';
import { useWizardStore } from '@/store/wizardStore';
import { CAMERAS, DIMENSIONS, GENRES, PLATFORMS, SCOPES } from '@/lib/wizardData';

export default function Step1Identity() {
  const s = useWizardStore();
  return (
    <StepWrapper
      step={1}
      label="Project Identity"
      title="What are you making?"
      subtitle={
        <>
          These foundational choices shape every prompt. Camera type is especially important — it determines how your character is shown and changes the art prompts significantly.
        </>
      }
    >
      <Field label="Game title or working title">
        <input
          type="text"
          value={s.gameTitle}
          onChange={(e) => s.set('gameTitle', e.target.value)}
          placeholder="e.g. Endeavor, Project Nova, Hollow Sun…"
        />
      </Field>

      <Field label="Genre">
        <CardGrid options={GENRES} value={s.genre} onChange={(v) => s.set('genre', v)} />
      </Field>

      <Field label="Primary platform">
        <CardGrid options={PLATFORMS} value={s.platform} onChange={(v) => s.set('platform', v)} size="sm" />
      </Field>

      <Divider />

      <Field label="Camera type">
        <CardGrid options={CAMERAS} value={s.cameraType} onChange={(v) => s.set('cameraType', v)} size="wide" />
      </Field>

      <Divider />

      <Field
        label="Dimension"
        hint="Stylized Painterly in 2D = Cuphead. In Full 3D = Dishonored. Same DNA, completely different pipelines."
      >
        <CardGrid options={DIMENSIONS} value={s.dimension} onChange={(v) => s.set('dimension', v)} />
      </Field>

      <Divider />

      <Field label="Production scope">
        <CardGrid options={SCOPES} value={s.scope} onChange={(v) => s.set('scope', v)} size="sm" />
      </Field>
    </StepWrapper>
  );
}
