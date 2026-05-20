'use client';

import type { OptionCard } from '@/types';

interface Props {
  options: OptionCard[];
  value: string;
  onChange: (v: string) => void;
  size?: 'sm' | 'wide' | 'default';
}

export default function CardGrid({ options, value, onChange, size = 'default' }: Props) {
  const cls = size === 'sm' ? 'cgrid cgrid-sm' : size === 'wide' ? 'cgrid cgrid-wide' : 'cgrid';
  return (
    <div className={cls}>
      {options.map((opt) => {
        const selected = opt.v === value;
        return (
          <button
            key={opt.v}
            type="button"
            className={`copt${selected ? ' sel' : ''}`}
            onClick={() => onChange(selected ? '' : opt.v)}
          >
            {opt.icon && <span className="copt-icon">{opt.icon}</span>}
            <span className="copt-title">{opt.title}</span>
            {opt.desc && <span className="copt-desc">{opt.desc}</span>}
          </button>
        );
      })}
    </div>
  );
}
