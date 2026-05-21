import type { ReactNode } from 'react';

interface Props {
  title: string;
  subtitle: ReactNode;
  children: ReactNode;
}

export default function StepWrapper({ title, subtitle, children }: Props) {
  return (
    <div>
      <div className="mb-7">
        <h2 className="text-[22px] font-bold mb-1.5">{title}</h2>
        <p className="text-[13px] text-text-2 leading-[1.65]">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}
