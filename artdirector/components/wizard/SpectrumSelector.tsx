'use client';

import { DNA_SPECTRUM } from '@/lib/dnaData';
import { useWizardStore } from '@/store/wizardStore';

export default function SpectrumSelector() {
  const dnaName = useWizardStore((s) => s.dnaName);
  const setDNA = useWizardStore((s) => s.setDNA);

  const selectedIdx = DNA_SPECTRUM.findIndex((d) => d.name === dnaName);
  const fillPct =
    selectedIdx >= 0 ? (selectedIdx / (DNA_SPECTRUM.length - 1)) * 100 : 0;
  const selected = selectedIdx >= 0 ? DNA_SPECTRUM[selectedIdx] : null;

  return (
    <div className="mb-6">
      <div className="flex justify-between text-[11px] text-text-3 mb-6">
        <span>← More real</span>
        <span>More abstract →</span>
      </div>

      <div className="relative mx-10 mb-8">
        <div className="absolute top-[11px] left-0 right-0 h-px bg-border-strong" />
        <div
          className="absolute top-[11px] left-0 h-px bg-accent transition-[width] duration-300"
          style={{ width: `${fillPct}%` }}
        />
        <div className="flex justify-between relative z-[1]">
          {DNA_SPECTRUM.map((d, i) => {
            const sel = i === selectedIdx;
            return (
              <button
                key={d.name}
                type="button"
                onClick={() => setDNA(d.name, d.v)}
                className="flex flex-col items-center gap-2.5 cursor-pointer flex-1 bg-transparent border-0 p-0"
              >
                <div
                  className={`w-6 h-6 rounded-full border-2 transition-all ${
                    sel
                      ? 'bg-accent border-accent'
                      : 'bg-surface-2 border-border-strong hover:border-accent'
                  }`}
                />
                <div
                  className={`text-[11px] text-center leading-[1.4] max-w-[90px] transition-colors ${
                    sel ? 'text-accent font-bold' : 'text-text-2'
                  }`}
                >
                  {d.name.split(' / ').map((piece, j, arr) => (
                    <span key={j}>
                      {piece}
                      {j < arr.length - 1 && <br />}
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {selected && (
        <div className="bg-surface border border-accent rounded-lg p-5 mt-2">
          <div className="text-[15px] font-bold mb-1.5">{selected.name}</div>
          <div className="text-[13px] text-text-2 mb-3 leading-[1.6]">{selected.desc}</div>
          <div className="flex flex-wrap gap-1.5 mb-2.5">
            {selected.tags.map((t) => (
              <span
                key={t}
                className="text-[10px] bg-accent-dim border border-accent/40 rounded-full px-2 py-0.5 text-accent"
              >
                {t}
              </span>
            ))}
          </div>
          <div className="text-[11px] text-text-3 leading-[1.5]">{selected.cross}</div>
        </div>
      )}
    </div>
  );
}
