import type { ReactNode } from 'react';

export function Field({ label, hint, children }: { label?: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="mb-[1.4rem]">
      {label && <label className="fld-lbl">{label}</label>}
      {children}
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

export function Divider() {
  return <hr className="divider" />;
}
