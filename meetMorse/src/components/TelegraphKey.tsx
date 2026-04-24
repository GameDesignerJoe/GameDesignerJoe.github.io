import { useEffect, useRef } from 'react';
import { useInputStore } from '../stores/inputStore';

export function TelegraphKey() {
  const pressing = useInputStore((s) => s.pressing);
  const pressDown = useInputStore((s) => s.pressDown);
  const pressUp = useInputStore((s) => s.pressUp);
  const spaceHeld = useRef(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat || spaceHeld.current) return;
      spaceHeld.current = true;
      e.preventDefault();
      pressDown();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      spaceHeld.current = false;
      e.preventDefault();
      pressUp();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [pressDown, pressUp]);

  return (
    <div className="flex flex-col items-center gap-3 py-4 select-none">
      <button
        ref={buttonRef}
        type="button"
        aria-label="Telegraph key"
        className="relative h-36 w-64 rounded-[2.5rem] outline-none focus:outline-none"
        style={{
          background:
            'linear-gradient(180deg, #8b5a2b 0%, #6b3f1c 55%, #4a2a12 100%)',
          boxShadow: pressing
            ? 'inset 0 6px 14px rgba(0,0,0,0.55), inset 0 -2px 4px rgba(255,200,140,0.25), 0 2px 6px rgba(0,0,0,0.4)'
            : 'inset 0 2px 6px rgba(255,200,140,0.35), inset 0 -6px 14px rgba(0,0,0,0.45), 0 10px 22px rgba(0,0,0,0.55)',
          transform: pressing ? 'translateY(4px)' : 'translateY(0)',
          transition: 'transform 60ms ease-out, box-shadow 60ms ease-out',
          touchAction: 'none',
          WebkitTouchCallout: 'none',
          userSelect: 'none',
          WebkitTapHighlightColor: 'transparent',
          cursor: 'pointer',
        }}
        onPointerDown={(e) => {
          (e.currentTarget as HTMLButtonElement).setPointerCapture?.(
            e.pointerId,
          );
          pressDown();
        }}
        onPointerUp={() => pressUp()}
        onPointerCancel={() => pressUp()}
        onPointerLeave={() => pressUp()}
        onContextMenu={(e) => e.preventDefault()}
      >
        <span
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-nameplate text-sm tracking-[0.35em]"
          style={{
            color: '#1a0e05',
            opacity: 0.55,
            textShadow: '0 1px 0 rgba(255,220,170,0.25)',
          }}
        >
          TAP · HOLD
        </span>
      </button>
      <div
        aria-hidden="true"
        className="h-1.5 w-72 rounded-full"
        style={{
          background:
            'linear-gradient(180deg, #c9a672 0%, #8a6c3d 100%)',
          boxShadow:
            'inset 0 1px 0 rgba(255,230,190,0.35), 0 2px 4px rgba(0,0,0,0.5)',
        }}
      />
    </div>
  );
}
