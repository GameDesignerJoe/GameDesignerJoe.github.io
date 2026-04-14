export default function Waveform({ visible }) {
  if (!visible) return null

  const bars = [
    { h: 5, delay: '0s' },
    { h: 10, delay: '0.15s' },
    { h: 16, delay: '0.3s' },
    { h: 10, delay: '0.15s' },
    { h: 5, delay: '0.05s' },
  ]

  return (
    <div className="flex items-end gap-[3px]" style={{ height: 16 }}>
      {bars.map((bar, i) => (
        <div
          key={i}
          className="rounded-sm"
          style={{
            width: 3,
            height: bar.h,
            background: 'var(--gold)',
            opacity: 0.75,
            animation: `wave 0.9s ease-in-out infinite`,
            animationDelay: bar.delay,
          }}
        />
      ))}
    </div>
  )
}
