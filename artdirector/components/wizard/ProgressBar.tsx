'use client';

import { TOTAL_STEPS } from '@/lib/wizardData';

export default function ProgressBar({ current }: { current: number }) {
  return (
    <div className="flex gap-[3px] mb-10">
      {Array.from({ length: TOTAL_STEPS }, (_, i) => {
        const step = i + 1;
        const cls =
          step < current
            ? 'bg-accent'
            : step === current
            ? 'bg-text-2'
            : 'bg-border-strong';
        return <div key={step} className={`flex-1 h-0.5 rounded transition-colors duration-200 ${cls}`} />;
      })}
    </div>
  );
}
