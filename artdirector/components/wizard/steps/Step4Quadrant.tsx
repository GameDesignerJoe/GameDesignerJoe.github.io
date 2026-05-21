'use client';

import StepWrapper from '../StepWrapper';
import QuadrantMap from '@/components/quadrant/QuadrantMap';
import { useWizardStore } from '@/store/wizardStore';

export default function Step4Quadrant() {
  const dnaName = useWizardStore((s) => s.dnaName);

  return (
    <StepWrapper
      title="See where your style sits"
      subtitle={
        <>
          Your DNA + tone choices place you on the 2D map of visual styles. Hover any reference game to see where it sits relative to you. <strong className="text-text font-semibold">Drag your dot</strong> to override if it doesn&apos;t feel right.
        </>
      }
    >
      {!dnaName && (
        <div className="text-[12px] text-text-3 bg-surface-2 border border-border rounded-lg px-3 py-2.5 mb-4 leading-[1.55]">
          Pick a Visual DNA on the previous step to plot your position. The map still works without it — your dot will sit at the center.
        </div>
      )}
      <QuadrantMap />
    </StepWrapper>
  );
}
