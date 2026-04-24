import { useEffect } from 'react';
import { MorseTree } from '../components/MorseTree';
import { PaperTape } from '../components/PaperTape';
import { TelegraphKey } from '../components/TelegraphKey';
import { useInputStore } from '../stores/inputStore';
import { useUIStore } from '../stores/uiStore';

export function GameScreen() {
  const setView = useUIStore((s) => s.setView);
  const resetTape = useInputStore((s) => s.resetTape);

  useEffect(() => {
    resetTape();
  }, [resetTape]);

  return (
    <div className="flex h-full w-full flex-col items-center gap-4 px-4 pt-3 pb-2">
      <div className="flex w-full max-w-[28rem] items-center justify-between">
        <button
          type="button"
          onClick={() => setView('home')}
          className="rounded-sm px-3 py-1 font-nameplate text-sm tracking-[0.25em]"
          style={{
            color: '#f1e1c0',
            background: 'rgba(176, 141, 87, 0.12)',
            border: '1px solid rgba(176, 141, 87, 0.4)',
          }}
        >
          ← BACK
        </button>
        <span
          className="font-nameplate text-sm tracking-[0.35em]"
          style={{ color: '#c9a672' }}
        >
          FREE PLAY
        </span>
        <span className="w-[68px]" />
      </div>

      <PaperTape />
      <MorseTree />

      <div className="flex-1" />

      <TelegraphKey />
    </div>
  );
}
