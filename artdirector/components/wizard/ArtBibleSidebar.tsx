'use client';

import { useWizardStore } from '@/store/wizardStore';

function capFirst(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
function short(s: string, w: number) {
  return capFirst((s || '').split(' ').slice(0, w).join(' '));
}

interface BibleItem {
  l: string;
  v: string;
  badge?: boolean;
}

export default function ArtBibleSidebar() {
  const s = useWizardStore();
  const items: BibleItem[] = [];
  if (s.gameTitle) items.push({ l: 'Project', v: s.gameTitle });
  if (s.genre) items.push({ l: 'Genre', v: short(s.genre, 2) });
  if (s.cameraType) items.push({ l: 'Camera', v: short(s.cameraType, 2) });
  if (s.dimension) items.push({ l: 'Dimension', v: short(s.dimension, 2) });
  if (s.scope) items.push({ l: 'Scope', v: short(s.scope, 2) });
  if (s.dnaName) items.push({ l: 'Visual DNA', v: s.dnaName, badge: true });
  if (s.tone) items.push({ l: 'Tone', v: short(s.tone, 2) });
  if (s.shapeLanguage) items.push({ l: 'Shape language', v: short(s.shapeLanguage, 2) });
  if (s.colorMood) items.push({ l: 'Color', v: short(s.colorMood, 2) });
  if (s.lighting) items.push({ l: 'Lighting', v: short(s.lighting, 2) });
  if (s.setting) items.push({ l: 'Setting', v: short(s.setting, 2) });
  if (s.referenceGames.length) {
    items.push({
      l: 'References',
      v:
        s.referenceGames.slice(0, 2).join(', ') +
        (s.referenceGames.length > 2 ? ' +' + (s.referenceGames.length - 2) : ''),
    });
  }
  if (s.enemyNature) items.push({ l: 'Enemies', v: short(s.enemyNature, 2) });
  if (s.equipAesthetic) items.push({ l: 'Equipment', v: short(s.equipAesthetic, 2) });

  return (
    <aside className="hidden md:block border-r border-border px-4 py-6 sticky top-0 h-screen overflow-y-auto">
      <div className="text-[10px] font-bold tracking-[.1em] text-text-3 uppercase mb-5">
        Art Direction Bible
      </div>
      {items.length === 0 ? (
        <div className="text-[12px] text-text-3 italic leading-[1.7]">
          Your visual rules appear here as you make choices.
        </div>
      ) : (
        <div>
          {items.map((it, i) => (
            <div
              key={it.l}
              className={`mb-[.9rem] pb-[.9rem] ${
                i < items.length - 1 ? 'border-b border-border' : ''
              }`}
            >
              <div className="text-[10px] uppercase tracking-[.06em] text-text-3 mb-0.5">{it.l}</div>
              <div className="text-[12px] text-text font-semibold">{it.v}</div>
              {it.badge && (
                <div className="inline-block text-[10px] font-bold bg-accent-dim text-accent rounded-full px-2 py-px mt-1">
                  Core DNA
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
