'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import ArtBible from '@/components/output/ArtBible';
import PromptCard from '@/components/output/PromptCard';
import HydrationGate from '@/components/HydrationGate';
import { buildPrompts } from '@/lib/promptBuilder';
import { useWizardStore } from '@/store/wizardStore';

function OutputContent() {
  const router = useRouter();
  const state = useWizardStore();
  const cards = useMemo(() => buildPrompts(state), [state]);

  const onRestart = () => {
    state.reset();
    router.push('/wizard/1');
  };

  return (
    <div className="min-h-screen px-5 md:px-10 pt-8 pb-16 max-w-output mx-auto">
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-[24px] font-bold mb-1">Art direction prompts</h1>
          <p className="text-[13px] text-text-2">
            Generated prompts for your pitch deck. Aspect ratio shown on each card.
          </p>
        </div>
        <button type="button" className="btn" onClick={onRestart}>
          ← Start over
        </button>
      </div>

      <ArtBible />

      <div className="flex flex-col gap-3">
        {cards.map((card) => (
          <PromptCard key={card.id} card={card} />
        ))}
      </div>

      <div className="mt-6 px-5 py-4 bg-surface border border-border rounded-lg">
        <h4 className="text-[12px] font-bold mb-1.5">Using aspect ratios in your AI generator</h4>
        <p className="text-[12px] text-text-2 leading-[1.65]">
          Specify ratio explicitly: Midjourney uses <code className="bg-surface-2 px-1.5 py-px rounded font-mono">--ar 16:9</code>,{' '}
          <code className="bg-surface-2 px-1.5 py-px rounded font-mono">--ar 1:1</code>,{' '}
          <code className="bg-surface-2 px-1.5 py-px rounded font-mono">--ar 2:3</code>,{' '}
          <code className="bg-surface-2 px-1.5 py-px rounded font-mono">--ar 4:1</code>. In Gemini Imagen, set width/height in advanced options. Environment shots at 16:9 go full-bleed on pitch deck slides. Square shots work as column inserts. The 4:1 title banner fits across the top of any slide.
        </p>
      </div>

      <div className="mt-8 text-center">
        <Link href="/wizard/1" className="text-[12px] text-text-3 hover:text-text-2">
          ← Back to wizard
        </Link>
      </div>
    </div>
  );
}

export default function OutputPage() {
  return (
    <HydrationGate>
      <OutputContent />
    </HydrationGate>
  );
}
