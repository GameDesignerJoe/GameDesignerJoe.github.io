'use client';

interface Props {
  num: number;
  title: string;
  sub: string;
  optional?: boolean;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

export default function EnvBlock({ num, title, sub, optional, value, onChange, placeholder }: Props) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-1.5">
        <div className="w-5 h-5 bg-accent-dim border border-accent rounded-full text-[10px] font-bold text-accent flex items-center justify-center flex-shrink-0">
          {num}
        </div>
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[.04em] text-text-2">
            {title}
            {optional && <span className="font-normal text-text-3"> (optional)</span>}
          </div>
          <div className="text-[11px] text-text-3">{sub}</div>
        </div>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
