import { useInputStore } from '../stores/inputStore';

export function PaperTape() {
  const tape = useInputStore((s) => s.tape);
  const currentCode = useInputStore((s) => s.currentCode);

  return (
    <div
      className="flex w-full max-w-[28rem] items-center justify-between rounded-sm border px-4 py-2"
      style={{
        borderColor: 'rgba(176, 141, 87, 0.45)',
        background:
          'linear-gradient(180deg, #f6edd8 0%, #eadfc3 100%)',
        boxShadow:
          'inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -2px 4px rgba(0,0,0,0.15), 0 6px 14px rgba(0,0,0,0.45)',
      }}
    >
      <div
        className="flex-1 overflow-hidden whitespace-nowrap text-right font-mono text-lg"
        style={{ color: '#3a2a15', letterSpacing: '0.35em' }}
      >
        {tape.length === 0 ? (
          <span style={{ color: 'rgba(58, 42, 21, 0.4)', letterSpacing: '0.15em' }}>
            start tapping…
          </span>
        ) : (
          tape.join('')
        )}
      </div>
      <div
        className="ml-4 min-w-[3rem] text-left font-mono text-base"
        style={{
          color: currentCode ? '#6b3f1c' : 'rgba(58, 42, 21, 0.25)',
          letterSpacing: '0.1em',
        }}
      >
        {currentCode || '·—'}
      </div>
    </div>
  );
}
