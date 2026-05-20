'use client';

import ProgressBar from './ProgressBar';
import NavBar from './NavBar';
import Step1Identity from './steps/Step1Identity';
import Step2Tone from './steps/Step2Tone';
import Step3DNA from './steps/Step3DNA';
import Step4Rules from './steps/Step4Rules';
import Step5References from './steps/Step5References';
import Step6Environments from './steps/Step6Environments';
import Step7Characters from './steps/Step7Characters';
import Step8Enemies from './steps/Step8Enemies';
import Step9Props from './steps/Step9Props';
import Step10TitleUI from './steps/Step10TitleUI';

const STEPS: Record<number, () => JSX.Element> = {
  1: Step1Identity,
  2: Step2Tone,
  3: Step3DNA,
  4: Step4Rules,
  5: Step5References,
  6: Step6Environments,
  7: Step7Characters,
  8: Step8Enemies,
  9: Step9Props,
  10: Step10TitleUI,
};

export default function WizardStepRouter({ step }: { step: number }) {
  const StepComp = STEPS[step];
  return (
    <>
      <ProgressBar current={step} />
      {StepComp && <StepComp />}
      <NavBar current={step} />
    </>
  );
}
