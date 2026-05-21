import { TOTAL_STEPS } from './steps';

interface Props {
  number: number;
  label: string;
}

export default function StepHeader({ number, label }: Props) {
  return (
    <div className="text-[10px] font-bold tracking-[.08em] uppercase text-accent mb-2">
      Step {number} of {TOTAL_STEPS} — {label}
    </div>
  );
}
