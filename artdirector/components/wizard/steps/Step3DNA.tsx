'use client';

import Link from 'next/link';
import StepWrapper from '../StepWrapper';
import SpectrumSelector from '../SpectrumSelector';

export default function Step3DNA() {
  return (
    <StepWrapper
      title="Pick one visual language"
      subtitle={
        <>
          This applies to <strong className="text-text font-semibold">everything</strong> — characters, enemies, environments, props. Mixing these across asset types is how games feel incoherent.
        </>
      }
    >
      <SpectrumSelector />

      <div className="mt-6 bg-surface border border-border rounded-lg p-4 flex items-center gap-4 flex-wrap">
        <div className="flex-1 min-w-[240px]">
          <div className="text-[12px] font-semibold text-text mb-0.5">
            Not sure which fits your game?
          </div>
          <div className="text-[11px] text-text-2 leading-[1.5]">
            Try the convergence finder — pick from generated A/B images across 4 rounds and we&apos;ll land you on a style.
          </div>
        </div>
        <Link
          href="/converge"
          className="btn btn-primary text-[12px] py-2 px-4 no-underline"
        >
          Help me find it →
        </Link>
      </div>
    </StepWrapper>
  );
}
