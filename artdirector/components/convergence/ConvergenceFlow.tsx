'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useWizardStore } from '@/store/wizardStore';
import {
  boundsCenter,
  buildConvergencePrompt,
  FULL_BOUNDS,
  getNextCandidates,
  TOTAL_ROUNDS,
  updateBounds,
  type Bounds,
  type Position,
} from '@/lib/convergence';
import { indexOfStep } from '@/components/wizard/steps';
import ConvergenceRound from './ConvergenceRound';

type Phase = 'intro' | 'round' | 'done';

interface HistoryEntry {
  round: number;
  posA: Position;
  posB: Position;
  chosen: 'A' | 'B';
}

export default function ConvergenceFlow() {
  const router = useRouter();
  const state = useWizardStore();
  const setQuadrant = useWizardStore((s) => s.setQuadrant);

  const [phase, setPhase] = useState<Phase>('intro');
  const [round, setRound] = useState(1);
  const [bounds, setBounds] = useState<Bounds>(FULL_BOUNDS);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const [posA, posB] = useMemo(() => getNextCandidates(bounds), [bounds]);
  const promptA = useMemo(() => buildConvergencePrompt(posA, state), [posA, state]);
  const promptB = useMemo(() => buildConvergencePrompt(posB, state), [posB, state]);

  function handleChoose(chosen: 'A' | 'B') {
    setHistory((h) => [...h, { round, posA, posB, chosen }]);
    const next = updateBounds(bounds, chosen, posA, posB);
    if (round >= TOTAL_ROUNDS) {
      // Lock final position to the chosen winner of the last round, mark manual,
      // then send the user to the quadrant step so they see where they landed.
      const final: Position = chosen === 'A' ? posA : posB;
      setQuadrant({ x: final[0], y: final[1] }, { manual: true });
      setPhase('done');
      setTimeout(() => router.push(`/wizard/${indexOfStep('quadrant')}`), 800);
      return;
    }
    setBounds(next);
    setRound((r) => r + 1);
  }

  function handleSkip() {
    router.push(`/wizard/${indexOfStep('dna')}`);
  }

  if (phase === 'intro') {
    return (
      <Shell>
        <h1 className="text-[24px] font-bold mb-3">Find your style</h1>
        <p className="text-[14px] text-text-2 leading-[1.65] mb-6 max-w-[560px]">
          Most people can&apos;t describe what they want, but everyone can say which of two
          options is closer. You&apos;ll see {TOTAL_ROUNDS} rounds of two generated images and pick
          which feels closer to your game. We&apos;ll plot you on the style map at the end.
        </p>
        <div className="bg-surface border border-border rounded-lg p-5 mb-6 text-[12px] text-text-2 leading-[1.6] max-w-[560px]">
          <strong className="text-text font-semibold">A note on cost:</strong> each round
          generates two images ({TOTAL_ROUNDS * 2} total, ~$0.025 in fal.ai credit). Identical
          prompts are cached per session, so neither restarting nor going back-and-forth re-bills.
        </div>
        <div className="flex gap-3 flex-wrap">
          <button type="button" className="btn btn-primary" onClick={() => setPhase('round')}>
            Start — Round 1 →
          </button>
          <button type="button" className="btn" onClick={handleSkip}>
            Cancel — I&apos;ll pick a DNA myself
          </button>
        </div>
      </Shell>
    );
  }

  if (phase === 'done') {
    return (
      <Shell>
        <h1 className="text-[22px] font-bold mb-3">Locked in.</h1>
        <p className="text-[14px] text-text-2 leading-[1.65]">
          Plotting your position on the style map…
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="flex items-center justify-between gap-4 mb-2 flex-wrap">
        <div className="text-[10px] font-bold tracking-[.1em] uppercase text-accent">
          Finding your style · Round {round} of {TOTAL_ROUNDS}
        </div>
        <button type="button" className="btn btn-sm" onClick={handleSkip}>
          Skip — describe it myself
        </button>
      </div>

      <div className="flex gap-[3px] mb-6">
        {Array.from({ length: TOTAL_ROUNDS }, (_, i) => {
          const step = i + 1;
          const cls =
            step < round
              ? 'bg-accent'
              : step === round
              ? 'bg-text-2'
              : 'bg-border-strong';
          return <div key={step} className={`flex-1 h-0.5 rounded ${cls}`} />;
        })}
      </div>

      <h2 className="text-[20px] font-bold mb-1">Which is closer to what you want?</h2>
      <p className="text-[13px] text-text-2 mb-6">
        Don&apos;t overthink it. Pick the one that feels more right.
      </p>

      <ConvergenceRound
        // key forces a remount when the round changes so internal image state resets cleanly
        key={round}
        promptA={promptA}
        promptB={promptB}
        onChoose={handleChoose}
      />

      {history.length > 0 && (
        <details className="mt-6 text-[11px] text-text-3 leading-[1.5]">
          <summary className="cursor-pointer hover:text-text-2 select-none">
            View pick history ({history.length})
          </summary>
          <ul className="mt-2 space-y-1 font-mono text-[10.5px]">
            {history.map((h, i) => {
              const winner = h.chosen === 'A' ? h.posA : h.posB;
              return (
                <li key={i}>
                  Round {h.round}: picked {h.chosen} ({Math.round(winner[0])}, {Math.round(winner[1])})
                </li>
              );
            })}
            <li className="text-text-2">
              Next bounds center: ({Math.round(boundsCenter(bounds)[0])}, {Math.round(boundsCenter(bounds)[1])})
            </li>
          </ul>
        </details>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen px-5 md:px-10 pt-10 pb-20 max-w-[920px] mx-auto">
      {children}
    </div>
  );
}
