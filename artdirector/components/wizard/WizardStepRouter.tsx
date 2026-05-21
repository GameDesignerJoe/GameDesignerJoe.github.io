'use client';

import ProgressBar from './ProgressBar';
import NavBar from './NavBar';
import StepHeader from './StepHeader';
import { getStepMeta } from './steps';

export default function WizardStepRouter({ step }: { step: number }) {
  const meta = getStepMeta(step);
  if (!meta) return null;
  const StepComp = meta.component;
  return (
    <>
      <ProgressBar current={step} />
      <StepHeader number={step} label={meta.label} />
      <StepComp />
      <NavBar current={step} />
    </>
  );
}
