import { useState, useRef } from 'react'
import { useStore } from '../../store'

export default function CsvImporter({ onClose }) {
  const setCreatorStory = useStore(s => s.setCreatorStory)
  const addStory = useStore(s => s.addStory)
  const [status, setStatus] = useState('')
  const [sceneCount, setSceneCount] = useState(0)
  const [storyTitle, setStoryTitle] = useState('')
  const fileRef = useRef(null)
  const [parsedData, setParsedData] = useState(null)

  const handleFile = async (file) => {
    if (!file) return
    setStatus('parsing')
    const Papa = (await import('papaparse')).default
    const text = await file.text()
    const { data, errors } = Papa.parse(text, { header: true, skipEmptyLines: true })
    if (errors.length > 0) {
      setStatus('error')
      return
    }
    setParsedData(data)
    setSceneCount(data.length)
    setStatus('loaded')
  }

  const handleFileInput = (e) => {
    const file = e.target.files[0]
    if (file) handleFile(file)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const handleClear = () => {
    setStatus('')
    setSceneCount(0)
    setParsedData(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleImport = () => {
    if (!parsedData || parsedData.length === 0) return
    const title = storyTitle.trim() || 'Imported Story'
    const storyId = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '')
    const scenes = {}
    let startScene = null

    parsedData.forEach(row => {
      const sceneId = row.scene_id?.trim()
      if (!sceneId) return
      const scene = {
        id: sceneId, title: row.title?.trim() || sceneId, emotion: row.emotion?.trim() || 'curious',
        bgKey: 'a', bgImage: null, clips: [],
        secondsBeforeEnd: parseInt(row.seconds_before_end) || 5,
        defaultChoice: row.default_choice !== undefined && row.default_choice !== '' ? parseInt(row.default_choice) : 0,
        countdown: parseInt(row.countdown_seconds) || 10, choices: [],
      }
      if (row.choice_1_text?.trim() && row.choice_1_target?.trim())
        scene.choices.push({ text: row.choice_1_text.trim(), target: row.choice_1_target.trim() })
      if (row.choice_2_text?.trim() && row.choice_2_target?.trim())
        scene.choices.push({ text: row.choice_2_text.trim(), target: row.choice_2_target.trim() })
      if (scene.choices.length === 0) { scene.defaultChoice = null; scene.countdown = 0; scene.secondsBeforeEnd = 0 }
      scenes[sceneId] = scene
      if (row.is_start?.trim()?.toUpperCase() === 'TRUE') startScene = sceneId
    })

    if (!startScene && Object.keys(scenes).length > 0) startScene = Object.keys(scenes)[0]

    const story = {
      id: storyId, title, tagline: '', description: '', tags: [],
      bg: 'linear-gradient(160deg,#0a0a0a 0%,#1a1208 100%)',
      bgs: { a: 'linear-gradient(160deg,#0a0a0a,#1a1208)', b: 'linear-gradient(160deg,#080808,#100c04)', c: 'linear-gradient(160deg,#0d0405,#1a0808)', d: 'linear-gradient(160deg,#050505,#080808)' },
      narrator: { name: 'Narrator', emoji: '🎭' },
      duration: `~${Math.ceil(Object.keys(scenes).length * 0.8)} min`, paths: 1, startScene, scenes,
    }
    addStory(story)
    setCreatorStory(story)
    setTimeout(() => onClose(), 500)
  }

  return (
    // Stitch: <div class="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-[10px] bg-[#07070f]/85">
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(7,7,15,0.85)',
        backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
        padding: '16px',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Stitch: <div class="w-full max-w-[520px] bg-[#0f0f1c] rounded-[16px] border border-[#222236]"> */}
      <div style={{
        width: '100%', maxWidth: '520px',
        background: '#0f0f1c', borderRadius: '16px',
        border: '1px solid #222236',
        boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '24px', borderBottom: '1px solid #222236',
        }}>
          <h2 style={{ fontFamily: "'EB Garamond', serif", fontStyle: 'italic', fontSize: '24px', color: '#f0ede6', margin: 0 }}>
            Import CSV
          </h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#706c8a', transition: 'color 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.color = '#f0ede6'}
            onMouseLeave={e => e.currentTarget.style.color = '#706c8a'}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>close</span>
          </button>
        </div>

        {/* Form Body */}
        <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {/* Story Title */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#928faa', fontFamily: "'DM Sans', sans-serif" }}>
              Story Title
            </label>
            <input
              type="text"
              value={storyTitle}
              onChange={e => setStoryTitle(e.target.value)}
              placeholder="e.g. Whispers of the Deep Forest"
              style={{
                width: '100%', background: '#181828', border: '1px solid #222236',
                borderRadius: '10px', color: '#f0ede6', padding: '12px 16px',
                fontSize: '14px', fontFamily: "'DM Sans', sans-serif",
                outline: 'none', transition: 'border-color 0.2s',
              }}
              onFocus={e => e.target.style.borderColor = '#c9a96e'}
              onBlur={e => e.target.style.borderColor = '#222236'}
            />
          </div>

          {/* CSV File */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#928faa', fontFamily: "'DM Sans', sans-serif" }}>
                CSV File
              </label>
              <p style={{ fontSize: '13px', color: '#928faa', lineHeight: 1.6, fontFamily: "'DM Sans', sans-serif" }}>
                Expected columns: scene_id, title, narration_script, choice_1_text, choice_1_target, choice_2_text, choice_2_target, emotion, is_start, default_choice, seconds_before_end, countdown_seconds, notes
              </p>
            </div>

            {/* Upload Area */}
            <div
              onClick={() => fileRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={e => e.preventDefault()}
              style={{
                border: '2px dashed #222236', borderRadius: '12px',
                padding: '40px 24px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: '12px', cursor: 'pointer', transition: 'background 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#181828'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{
                width: '48px', height: '48px', borderRadius: '50%',
                background: '#181828', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span className="material-symbols-outlined" style={{ color: '#c9a96e' }}>upload_file</span>
              </div>
              <p style={{ fontSize: '14px', color: '#928faa', fontFamily: "'DM Sans', sans-serif" }}>
                Drop CSV file here or click to browse
              </p>
              <input ref={fileRef} type="file" accept=".csv" onChange={handleFileInput} style={{ display: 'none' }} />
            </div>
          </div>

          {/* Status Area */}
          {status === 'loaded' && (
            <div style={{
              background: '#181828', border: '1px solid #222236', borderRadius: '10px',
              padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span className="material-symbols-outlined" style={{ color: '#10b981', fontSize: '20px', fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                <span style={{ color: '#f0ede6', fontSize: '14px', fontWeight: 500, fontFamily: "'DM Sans', sans-serif" }}>{sceneCount} scenes loaded</span>
              </div>
              <button
                onClick={handleClear}
                style={{
                  background: 'none', border: 'none', color: '#706c8a',
                  fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em',
                  fontWeight: 700, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                }}
              >
                Clear
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '0 32px 32px' }}>
          <button
            onClick={handleImport}
            disabled={status !== 'loaded'}
            style={{
              width: '100%', padding: '16px',
              background: status === 'loaded' ? '#c9a96e' : '#222236',
              color: status === 'loaded' ? '#07070f' : '#706c8a',
              border: 'none', borderRadius: '9999px',
              fontSize: '13px', fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.2em', cursor: status === 'loaded' ? 'pointer' : 'default',
              fontFamily: "'DM Sans', sans-serif",
              boxShadow: status === 'loaded' ? '0 4px 20px rgba(201,169,110,0.2)' : 'none',
              transition: 'all 0.2s',
            }}
          >
            Import & Load into Editor
          </button>
        </div>
      </div>
    </div>
  )
}
