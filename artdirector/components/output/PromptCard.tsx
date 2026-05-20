'use client';

import { useState } from 'react';
import type { PromptCardData } from '@/types';

export default function PromptCard({ card }: { card: PromptCardData }) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(card.prompt);
    } catch {
      const ta = document.getElementById('ptxt-' + card.id) as HTMLTextAreaElement | null;
      if (ta) {
        ta.select();
        document.execCommand('copy');
      }
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-surface border border-border rounded-lg px-5 py-4">
      <div className="flex items-center gap-2.5 mb-2.5 flex-wrap">
        <div className="w-[26px] h-[26px] bg-surface-2 rounded-full text-[11px] font-bold text-text-2 flex items-center justify-center flex-shrink-0">
          {card.num}
        </div>
        <div>
          <div className="text-[14px] font-bold">
            {card.icon} {card.name}
          </div>
          <div className="text-[11px] text-text-2">{card.description}</div>
        </div>
        <div className="flex gap-1.5 ml-auto flex-wrap">
          <span className="text-[10px] bg-accent-dim border border-accent/40 text-accent rounded-full px-2 py-px whitespace-nowrap">
            {card.badge}
          </span>
          <span className="text-[10px] bg-surface-2 border border-border-strong text-text-2 rounded-full px-2 py-px whitespace-nowrap">
            {card.ratio}
          </span>
        </div>
      </div>
      <textarea
        id={'ptxt-' + card.id}
        readOnly
        className="w-full bg-surface-2 border border-border rounded text-text-2 text-[11px] font-mono p-2.5 leading-[1.65] resize-y min-h-[84px] mb-2 outline-none"
        value={card.prompt}
      />
      <div className="flex items-center gap-2">
        <button type="button" className="btn btn-sm" onClick={onCopy}>
          Copy
        </button>
        <a className="text-[12px] text-text-3 no-underline hover:text-text-2" href={card.refUrl} target="_blank" rel="noreferrer">
          ↗ References
        </a>
        <span
          className={`text-[11px] text-success transition-opacity ${copied ? 'opacity-100' : 'opacity-0'}`}
        >
          ✓ Copied!
        </span>
      </div>
    </div>
  );
}
