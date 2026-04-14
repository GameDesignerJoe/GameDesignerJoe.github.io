export default function ResumeModal({ show, sceneTitle, onResume, onFresh }) {
  if (!show) return null

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        background: 'rgba(7,7,15,0.85)',
        backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
      }}
    >
      <div style={{
        width: '100%', maxWidth: '480px',
        background: '#0f0f1c',
        borderRadius: '24px 24px 0 0',
        border: '1px solid #222236',
        borderBottom: 'none',
        padding: '32px 32px max(40px, env(safe-area-inset-bottom))',
      }}>
        {/* Handle */}
        <div style={{
          width: '34px', height: '4px', borderRadius: '2px',
          background: '#222236', margin: '0 auto 28px',
        }} />

        {/* Title */}
        <h3 style={{
          fontFamily: "'Newsreader', serif", fontStyle: 'italic',
          fontSize: '28px', color: '#e5e3ff', marginBottom: '10px',
        }}>
          Welcome back
        </h3>

        {/* Subtitle */}
        <p style={{
          fontFamily: "'Public Sans', sans-serif", fontSize: '15px',
          fontWeight: 300, lineHeight: 1.6, color: '#928faa',
          marginBottom: '32px',
        }}>
          You left off at &ldquo;{sceneTitle}&rdquo;. Continue from there?
        </p>

        {/* Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button
            onClick={onResume}
            style={{
              width: '100%', padding: '18px 24px',
              borderRadius: '9999px', border: 'none',
              background: '#c9a96e', color: '#503a08',
              fontFamily: "'DM Sans', sans-serif", fontSize: '14px',
              fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
              cursor: 'pointer', transition: 'all 0.2s',
              textAlign: 'center',
            }}
          >
            Continue where I left off
          </button>
          <button
            onClick={onFresh}
            style={{
              width: '100%', padding: '18px 24px',
              borderRadius: '9999px',
              background: '#181828', color: '#e5e3ff',
              border: '1px solid #222236',
              fontFamily: "'DM Sans', sans-serif", fontSize: '14px',
              fontWeight: 500, letterSpacing: '0.04em',
              cursor: 'pointer', transition: 'all 0.2s',
              textAlign: 'center',
            }}
          >
            Start from the beginning
          </button>
        </div>
      </div>
    </div>
  )
}
