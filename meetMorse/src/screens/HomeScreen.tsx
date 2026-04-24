import { useUIStore } from '../stores/uiStore';

export function HomeScreen() {
  const setView = useUIStore((s) => s.setView);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-10 px-6">
      <div
        className="rounded-sm px-10 py-5"
        style={{
          background:
            'linear-gradient(180deg, #c9a672 0%, #b08d57 45%, #8a6c3d 100%)',
          boxShadow:
            'inset 0 0 0 2px rgba(0,0,0,0.35), inset 0 2px 4px rgba(255,220,170,0.35), 0 8px 24px rgba(0,0,0,0.5)',
        }}
      >
        <h1
          className="font-nameplate text-5xl font-semibold tracking-[0.25em]"
          style={{
            color: '#3a2a15',
            textShadow:
              '0 1px 0 rgba(255,230,190,0.35), 0 -1px 0 rgba(0,0,0,0.4)',
          }}
        >
          MEET MORSE
        </h1>
      </div>

      <button
        type="button"
        onClick={() => setView('game')}
        className="rounded-sm px-8 py-3 font-nameplate text-2xl tracking-[0.3em]"
        style={{
          color: '#1a0e05',
          background:
            'linear-gradient(180deg, #d4b47f 0%, #b08d57 55%, #8a6c3d 100%)',
          boxShadow:
            'inset 0 1px 0 rgba(255,230,190,0.5), inset 0 -2px 4px rgba(0,0,0,0.35), 0 4px 10px rgba(0,0,0,0.45)',
          cursor: 'pointer',
        }}
      >
        PLAY
      </button>
    </div>
  );
}
