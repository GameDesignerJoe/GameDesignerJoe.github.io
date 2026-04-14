export default function Waveform({ visible }) {
  if (!visible) return null

  // Matches Stitch: 5 bars at heights 2/4/5/3/4 (scaled to px)
  const bars = [
    { h: 8, delay: '0s' },
    { h: 16, delay: '0.15s' },
    { h: 20, delay: '0.3s' },
    { h: 12, delay: '0.15s' },
    { h: 16, delay: '0.05s' },
  ]

  return (
    <div className="flex items-end space-x-1" style={{ height: 20 }}>
      {bars.map((bar, i) => (
        <div
          key={i}
          className="waveform-bar"
          style={{
            width: 3,
            height: bar.h,
            backgroundColor: '#c9a96e',
            borderRadius: 99,
            animation: 'wave 0.9s ease-in-out infinite',
            animationDelay: bar.delay,
          }}
        />
      ))}
    </div>
  )
}
