export default function ResumeModal({ show, sceneTitle, onResume, onFresh }) {
  if (!show) return null

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end transition-opacity duration-300"
      style={{
        background: 'rgba(7,7,15,0.82)',
        backdropFilter: 'blur(10px)',
        opacity: show ? 1 : 0,
        pointerEvents: show ? 'all' : 'none',
        transitionTimingFunction: 'var(--silk)',
      }}
    >
      <div
        className="w-full transition-transform duration-450"
        style={{
          background: 'var(--s1)',
          borderRadius: 'var(--rxl) var(--rxl) 0 0',
          border: '1px solid var(--s3)',
          borderBottom: 'none',
          padding: '28px 26px max(36px, env(safe-area-inset-bottom))',
          transform: show ? 'translateY(0)' : 'translateY(100%)',
          transitionTimingFunction: 'var(--spring)',
        }}
      >
        {/* Handle */}
        <div className="w-[34px] h-1 rounded-sm mx-auto mb-6" style={{ background: 'var(--s3)' }} />

        <h3 className="font-display italic text-[28px] mb-2">Welcome back</h3>
        <p className="text-sm font-light leading-relaxed mb-7" style={{ color: 'var(--sub)' }}>
          You left off at "{sceneTitle}". Continue from there?
        </p>

        <div className="flex flex-col gap-[10px]">
          <button
            className="py-[18px] rounded-[var(--r)] text-[15px] text-center cursor-pointer transition-all active:scale-[0.97] font-medium"
            style={{ background: 'var(--gold)', border: '1px solid var(--gold)', color: 'var(--bg)' }}
            onClick={onResume}
          >
            Continue where I left off
          </button>
          <button
            className="py-[18px] rounded-[var(--r)] text-[15px] text-center cursor-pointer transition-all active:scale-[0.97]"
            style={{ background: 'var(--s2)', border: '1px solid var(--s3)', color: 'var(--text)' }}
            onClick={onFresh}
          >
            Start from the beginning
          </button>
        </div>
      </div>
    </div>
  )
}
