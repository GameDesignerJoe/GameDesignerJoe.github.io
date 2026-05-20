import type { ReactNode } from 'react';
import { TOTAL_STEPS } from '@/lib/wizardData';

interface Props {
  step: number;
  label: string;
  title: string;
  subtitle: ReactNode;
  children: ReactNode;
}

export default function StepWrapper({ step, label, title, subtitle, children }: Props) {
  return (
    <div>
      <div className="text-[10px] font-bold tracking-[.08em] uppercase text-accent mb-2">
        Step {step} of {TOTAL_STEPS} — {label}
      </div>
      <div className="mb-7">
        <h2 className="text-[22px] font-bold mb-1.5">{title}</h2>
        <p className="text-[13px] text-text-2 leading-[1.65]">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}
