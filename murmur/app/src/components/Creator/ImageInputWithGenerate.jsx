import { useState } from 'react'
import { resolveAssetPath } from '../../engine/assetPath'

/**
 * ImageInputWithGenerate
 * ----------------------
 * Text input + inline ✨ sparkle button that opens the Image Studio for a slot.
 *
 * - If `value` is a `blob:` URL, we show the expected on-disk target path
 *   in the input (if `targetPath` was provided) instead of the raw URL.
 * - If `value` resolves to an image (blob: URL or path), we render a centered
 *   thumbnail above the input, sized to `aspectRatio`.
 * - Click the thumbnail to open a fullscreen lightbox preview.
 *
 * Props:
 *   value          — current field value (blob URL, path, or empty)
 *   placeholder    — input placeholder
 *   onChange(url)  — called when the user types/clears the path
 *   onGenerate?()  — if set, renders the ✨ button that triggers Image Studio
 *   aspectRatio    — CSS aspect-ratio notation, e.g. '16/9' or '3/4'
 *   targetPath     — string shown in the input when value is a blob (helpful
 *                    for previewing what will be saved)
 *   thumbMaxWidth  — pixels (default 360)
 */
export default function ImageInputWithGenerate({
  value,
  placeholder,
  onChange,
  onGenerate,
  aspectRatio = '16/9',
  targetPath = '',
  thumbMaxWidth = 360,
}) {
  const isBlob = typeof value === 'string' && value.startsWith('blob:')
  const display = isBlob ? (targetPath || '') : (value || '')
  const hasImage = typeof value === 'string' && value.length > 0
  const [lightboxOpen, setLightboxOpen] = useState(false)

  return (
    <div>
      {hasImage && (
        <div
          onClick={() => setLightboxOpen(true)}
          title="Click to enlarge"
          style={{
            marginBottom: '10px',
            marginLeft: 'auto',
            marginRight: 'auto',
            borderRadius: '12px',
            overflow: 'hidden',
            border: '1px solid var(--s3)',
            background: 'var(--s2)',
            maxWidth: `${thumbMaxWidth}px`,
            aspectRatio,
            cursor: 'zoom-in',
            transition: 'border-color 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--gold)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--s3)'}
        >
          <img
            src={resolveAssetPath(value)}
            alt="Preview"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            onError={e => { e.currentTarget.style.display = 'none' }}
          />
        </div>
      )}
      {lightboxOpen && hasImage && (
        <div
          onClick={() => setLightboxOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 300,
            background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '40px', cursor: 'zoom-out',
          }}
        >
          <img
            src={resolveAssetPath(value)}
            alt="Full-size preview"
            style={{ maxWidth: '100%', maxHeight: 'calc(100vh - 80px)', objectFit: 'contain', borderRadius: '12px', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}
          />
        </div>
      )}
      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          className="cr-input"
          value={display}
          placeholder={placeholder}
          readOnly={isBlob}
          onChange={e => onChange(e.target.value.trim())}
          style={{ flex: 1, color: 'var(--text)' }}
        />
        {onGenerate && (
          <button
            onClick={onGenerate}
            title="Generate with AI"
            style={{
              flexShrink: 0,
              width: '42px',
              background: 'transparent',
              border: '1px solid var(--gold)',
              borderRadius: '12px',
              color: 'var(--gold)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--gold)'; e.currentTarget.style.color = 'var(--bg)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--gold)' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>auto_awesome</span>
          </button>
        )}
      </div>
    </div>
  )
}
