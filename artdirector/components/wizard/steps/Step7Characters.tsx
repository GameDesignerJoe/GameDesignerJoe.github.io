'use client';

import StepWrapper from '../StepWrapper';
import CardGrid from '../CardGrid';
import { Field } from '../Field';
import { isFP, useWizardStore } from '@/store/wizardStore';
import { BODY_PROPS, COSTUME_COMPS } from '@/lib/wizardData';

export default function Step7Characters() {
  const s = useWizardStore();
  const firstPerson = isFP(s);

  return (
    <StepWrapper
      step={7}
      label="Player Characters"
      title="Who is the player?"
      subtitle={
        <>
          Player characters carry the visual identity of the whole game. Their silhouette becomes your logo.
        </>
      }
    >
      {firstPerson && (
        <div className="bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-[12px] text-text-2 mb-5 leading-[1.55]">
          <strong className="text-text font-semibold">First-person camera selected.</strong> The full player character is never shown in-game. Instead of a character portrait, you&apos;ll get a <strong className="text-text font-semibold">first-person hands/arms study</strong> — what the player sees of themselves. Key art will show first-person perspective looking into the world rather than a hero pose.
        </div>
      )}

      {!firstPerson && (
        <>
          <Field label="Body proportions">
            <CardGrid options={BODY_PROPS} value={s.bodyProp} onChange={(v) => s.set('bodyProp', v)} size="sm" />
          </Field>

          <Field label="Costume and gear complexity">
            <CardGrid options={COSTUME_COMPS} value={s.costumeComp} onChange={(v) => s.set('costumeComp', v)} size="sm" />
          </Field>

          <Field label="Describe your main character">
            <textarea
              value={s.charDesc}
              onChange={(e) => s.set('charDesc', e.target.value)}
              placeholder="e.g. A battle-scarred mercenary in salvaged combat armor, mid-30s, intense face with a jaw scar, mismatched gear maintained for years…"
            />
          </Field>
        </>
      )}

      {firstPerson && (
        <Field
          label="Describe what the player sees of themselves"
          hint="Hands, arms, held items. This feeds the hands study prompt and appears in foreground of action shots."
        >
          <textarea
            value={s.handsDesc}
            onChange={(e) => s.set('handsDesc', e.target.value)}
            placeholder="e.g. Gloved weathered hands gripping a modified plasma rifle, salvaged tactical sleeve visible at the wrist, worn leather and metal…"
          />
        </Field>
      )}
    </StepWrapper>
  );
}
