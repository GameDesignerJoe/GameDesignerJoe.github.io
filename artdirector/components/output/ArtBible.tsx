'use client';

import { getScopeKey, noEnemies, noWeapons, useWizardStore } from '@/store/wizardStore';
import { SCOPE_LABELS } from '@/lib/dnaData';

function capFirst(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
function short(s: string, w: number) {
  return capFirst((s || '').split(' ').slice(0, w).join(' '));
}

export default function ArtBible() {
  const s = useWizardStore();
  const scopeKey = getScopeKey(s);
  const rules: Array<{ l: string; v: string; sub?: string }> = [
    { l: 'Visual DNA', v: s.dnaName || '—', sub: 'Applies to all assets' },
    { l: 'Camera', v: short(s.cameraType, 2) || '—' },
    { l: 'Dimension', v: short(s.dimension, 2) || '—' },
    { l: 'Scope', v: SCOPE_LABELS[scopeKey] || '—' },
    { l: 'Shape language', v: short(s.shapeLanguage, 3) || '—' },
    { l: 'Color palette', v: short(s.colorMood, 3) || '—' },
    { l: 'Lighting', v: short(s.lighting, 3) || '—' },
    { l: 'Tone', v: short(s.tone, 3) || '—' },
    { l: 'Enemies', v: noEnemies(s) ? 'None' : short(s.enemyNature, 2) || '—' },
    { l: 'Equipment', v: noWeapons(s) ? 'No weapons' : short(s.equipAesthetic, 2) || '—' },
    {
      l: 'References',
      v: s.referenceGames.length ? s.referenceGames.slice(0, 3).join(', ') : '—',
    },
  ];

  return (
    <div className="bg-surface border border-border rounded-lg px-6 py-5 mb-8">
      <h3 className="text-[10px] font-bold tracking-[.08em] uppercase text-text-3 mb-4">
        Art Direction Bible — all prompts use these rules
      </h3>
      <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(140px,1fr))]">
        {rules.map((r) => (
          <div key={r.l}>
            <div className="text-[10px] uppercase tracking-[.06em] text-text-3 mb-0.5">{r.l}</div>
            <div className="text-[13px] font-bold text-text">{r.v}</div>
            {r.sub && <div className="text-[11px] text-text-2 mt-0.5">{r.sub}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
