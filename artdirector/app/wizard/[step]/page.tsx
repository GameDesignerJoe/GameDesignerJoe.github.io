import { notFound } from 'next/navigation';
import WizardStepRouter from '@/components/wizard/WizardStepRouter';
import { TOTAL_STEPS } from '@/lib/wizardData';

export function generateStaticParams() {
  return Array.from({ length: TOTAL_STEPS }, (_, i) => ({ step: String(i + 1) }));
}

export default function WizardStepPage({ params }: { params: { step: string } }) {
  const step = parseInt(params.step, 10);
  if (!Number.isFinite(step) || step < 1 || step > TOTAL_STEPS) notFound();
  return <WizardStepRouter step={step} />;
}
