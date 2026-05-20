'use client';

import { GAMES_BY_DNA, SCOPE_LABELS } from '@/lib/dnaData';
import { getScopeKey, useWizardStore } from '@/store/wizardStore';
import type { GameRef } from '@/types';

const SCOPE_ORDER: Array<'indie' | 'mid' | 'aaa'> = ['indie', 'mid', 'aaa'];
const SHORT_LABELS: Record<string, string> = { indie: 'Indie', mid: 'Mid-tier', aaa: 'AAA' };

export default function GameChips() {
  const state = useWizardStore();
  const { dnaName, referenceGames, toggleReferenceGame } = state;
  const scopeKey = getScopeKey(state);

  if (!dnaName) {
    return (
      <div className="text-[13px] text-text-3 italic py-4">
        Choose a Visual DNA in Step 3 to see relevant references.
      </div>
    );
  }

  const games = GAMES_BY_DNA[dnaName] || [];
  const groups: Record<string, GameRef[]> = { indie: [], mid: [], aaa: [] };
  games.forEach((g) => {
    groups[g.scope].push(g);
  });

  return (
    <div>
      {scopeKey && (
        <div className="text-[11px] text-text-3 bg-surface-2 border border-border rounded-lg px-2.5 py-2 mb-4 leading-[1.5]">
          Your scope is <strong className="text-text font-semibold">{SCOPE_LABELS[scopeKey]}</strong>.
          Highlighted games are closest to your production scale. Others are useful tonal references.
        </div>
      )}

      {SCOPE_ORDER.map((s) =>
        groups[s].length ? (
          <div key={s} className="mb-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-[.07em] text-text-3">
                {SCOPE_LABELS[s]}
              </span>
              <span
                className={`text-[9px] font-bold rounded-full px-2 py-px tracking-[.04em] ${
                  s === 'indie'
                    ? 'bg-indie border border-indie-b text-indie-t'
                    : s === 'mid'
                    ? 'bg-mid border border-mid-b text-mid-t'
                    : 'bg-aaa border border-aaa-b text-aaa-t'
                } border`}
              >
                {SHORT_LABELS[s]}
              </span>
              {s !== scopeKey && scopeKey && (
                <span className="text-[10px] text-text-3">tonal reference</span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {groups[s].map((g) => {
                const sel = referenceGames.includes(g.n);
                const url =
                  'https://www.google.com/search?q=' + encodeURIComponent(g.q) + '&tbm=isch';
                return (
                  <div
                    key={g.n}
                    onClick={() => toggleReferenceGame(g.n)}
                    className={`inline-flex items-center px-2.5 py-1 border rounded-full bg-surface text-[12px] cursor-pointer select-none transition-all whitespace-nowrap ${
                      sel
                        ? 'border-accent bg-accent-dim text-accent'
                        : `text-text-2 hover:text-text ${
                            s === scopeKey ? 'border-border-strong' : 'border-border'
                          } hover:border-border-strong`
                    }`}
                  >
                    {g.n}
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className={`border-l pl-1.5 ml-1.5 text-[11px] no-underline ${
                        sel
                          ? 'border-accent/40 text-accent/60 hover:text-text'
                          : 'border-border text-text-3 hover:text-text'
                      }`}
                    >
                      ↗
                    </a>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null
      )}

      {referenceGames.length > 0 && (
        <div className="text-[12px] text-text-2 px-2.5 py-2 bg-surface-2 border border-border rounded-lg mt-2">
          <strong className="text-text font-semibold">Selected:</strong> {referenceGames.join(', ')}
        </div>
      )}
    </div>
  );
}
