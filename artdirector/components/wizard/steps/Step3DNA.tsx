'use client';

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
    </StepWrapper>
  );
}
