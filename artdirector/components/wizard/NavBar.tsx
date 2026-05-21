'use client';

import { useRouter } from 'next/navigation';
import { TOTAL_STEPS } from './steps';

export default function NavBar({ current }: { current: number }) {
  const router = useRouter();
  const onPrev = () => {
    if (current > 1) router.push(`/wizard/${current - 1}`);
  };
  const onNext = () => {
    if (current < TOTAL_STEPS) router.push(`/wizard/${current + 1}`);
    else router.push('/output');
  };

  return (
    <div className="nav-bar-fixed">
      <button
        type="button"
        className="btn"
        onClick={onPrev}
        style={{ visibility: current === 1 ? 'hidden' : 'visible' }}
      >
        ← Back
      </button>
      <span className="text-[12px] text-text-3">
        Step {current} of {TOTAL_STEPS}
      </span>
      <button type="button" className="btn btn-primary" onClick={onNext}>
        {current === TOTAL_STEPS ? 'Generate prompts →' : 'Next →'}
      </button>
    </div>
  );
}
