'use client';

import StepWrapper from '../StepWrapper';
import CardGrid from '../CardGrid';
import EnvBlock from '../EnvBlock';
import { Divider, Field } from '../Field';
import { useWizardStore } from '@/store/wizardStore';
import { SETTINGS } from '@/lib/wizardData';

export default function Step6Environments() {
  const s = useWizardStore();
  return (
    <StepWrapper
      title="Where does this happen?"
      subtitle={
        <>
          Three environments produce three separate 16:9 shots for your pitch deck. Each should be meaningfully different from the last to show your world&apos;s range.
        </>
      }
    >
      <Field label="Setting">
        <CardGrid options={SETTINGS} value={s.setting} onChange={(v) => s.set('setting', v)} />
      </Field>

      <Field label="Architecture style (applies to all environments)">
        <input
          type="text"
          value={s.archStyle}
          onChange={(e) => s.set('archStyle', e.target.value)}
          placeholder="e.g. Brutalist megastructures consumed by alien growth, Gothic spires fused with machinery…"
        />
      </Field>

      <Divider />

      <EnvBlock
        num={1}
        title="Primary environment"
        sub="Signature location — where players spend the most time"
        value={s.envDesc1}
        onChange={(v) => s.set('envDesc1', v)}
        placeholder="e.g. A crumbling orbital station overgrown with alien flora, lit by a dying red star. Military corridors fused with spreading organic architecture…"
      />
      <EnvBlock
        num={2}
        title="Secondary environment"
        sub="A distinctly different area players explore"
        value={s.envDesc2}
        onChange={(v) => s.set('envDesc2', v)}
        placeholder="e.g. An ancient alien archive deep underground, crystalline structures, bioluminescent glow, vast cathedral-like silence…"
      />
      <EnvBlock
        num={3}
        title="Third environment"
        sub="Maximum contrast — the space that feels most different"
        optional
        value={s.envDesc3}
        onChange={(v) => s.set('envDesc3', v)}
        placeholder="e.g. Open alien surface, vast sky, ruins of a crashed fleet on the horizon, first time seeing natural light…"
      />
    </StepWrapper>
  );
}
