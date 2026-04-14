import { useStore } from '../../store'
import NodeGraph from './NodeGraph'
import EditPanel from './EditPanel'
import CsvImporter from './CsvImporter'
import { useState, useRef, useEffect, useCallback } from 'react'

export default function Creator() {
  const view = useStore(s => s.view)
  const setView = useStore(s => s.setView)
  const creator = useStore(s => s.creator)
  const stories = useStore(s => s.stories)
  const setCreatorStory = useStore(s => s.setCreatorStory)
  const launchStory = useStore(s => s.launchStory)
  const addScene = useStore(s => s.addScene)
  const selectNode = useStore(s => s.selectNode)
  const [showCsvModal, setShowCsvModal] = useState(false)
  const [showTtsModal, setShowTtsModal] = useState(false)
  const [panelWidth, setPanelWidth] = useState(360)

  if (view !== 'creator') return null

  const { story, selectedNodeId } = creator

  const exportStory = () => {
    if (!story) return
    const clean = JSON.parse(JSON.stringify(story))
    delete clean._pos
    const blob = new Blob([JSON.stringify(clean, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = clean.id + '.json'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const importJson = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = e.target.files[0]
      if (!file) return
      const text = await file.text()
      try {
        const story = JSON.parse(text)
        if (story.scenes && story.id) {
          setCreatorStory(story)
          useStore.getState().addStory(story)
        } else {
          alert('Invalid story JSON')
        }
      } catch {
        alert('Failed to parse JSON file')
      }
    }
    input.click()
  }

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: 'var(--bg)' }}>
      {/* Header — matches Stitch creator-main.html */}
      <header style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '0 24px', height: '56px', flexShrink: 0,
        background: '#07070f', borderBottom: '1px solid #222236',
      }}>
        {/* Left: back + title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div
            style={{
              fontFamily: "'EB Garamond', serif", fontStyle: 'italic', fontSize: '20px',
              color: '#c9a96e', letterSpacing: '0.1em', textTransform: 'uppercase',
              cursor: 'pointer', fontWeight: 700,
            }}
            onClick={() => setView('library')}
          >
            ‹ Murmur
          </div>
          <div style={{ height: '16px', width: '1px', background: '#222236' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', position: 'relative' }}>
            <select
              value={story?.id || ''}
              onChange={e => {
                const found = stories.find(s => s.id === e.target.value)
                if (found) setCreatorStory(found)
              }}
              style={{
                background: 'transparent', border: 'none',
                color: '#a9a8ca', fontSize: '14px', fontWeight: 500,
                fontFamily: "'DM Sans', sans-serif",
                cursor: 'pointer', outline: 'none',
                paddingRight: '24px',
                appearance: 'none',
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='%23706c8a'%3E%3Cpath d='M7 10l5 5 5-5z'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 4px center',
              }}
            >
              {stories.map(s => (
                <option key={s.id} value={s.id} style={{ background: '#0f0f1c', color: '#f0ede6' }}>{s.title}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Right: action groups */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Grouped text buttons */}
          <div style={{
            display: 'flex', alignItems: 'center',
            background: '#0f0f1c', border: '1px solid #222236', borderRadius: '6px',
            padding: '4px 12px', gap: '16px',
            fontFamily: "'DM Sans', sans-serif", fontSize: '13px', fontWeight: 500, color: '#a9a8ca',
          }}>
            <HeaderTextBtn icon="add" label="Scene" onClick={addScene} />
            <HeaderTextBtn label="Import JSON" onClick={importJson} />
            <HeaderTextBtn label="Import CSV" onClick={() => setShowCsvModal(true)} />
            <HeaderTextBtn icon="volume_up" label="TTS" onClick={() => setShowTtsModal(true)} />
          </div>

          {/* Icon buttons: Play, Save, History */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <HeaderIconBtn icon="play_arrow" title="Play story" onClick={() => {
              if (story) launchStory(story, story.startScene)
            }} />
            <HeaderIconBtn icon="save" title="Save (auto)" />
            <HeaderIconBtn icon="history" title="History" />
          </div>

          {/* Export gold button */}
          <button
            onClick={exportStory}
            style={{
              background: '#c9a96e', color: '#412d00',
              padding: '6px 20px', borderRadius: '9999px', border: 'none',
              fontSize: '13px', fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.08em', cursor: 'pointer',
              fontFamily: "'DM Sans', sans-serif",
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            Export
          </button>
        </div>
      </header>

      {/* Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-[250px] flex flex-col flex-shrink-0 relative z-10" style={{ borderRight: '1px solid var(--s3)' }}>
          <div
            className="flex justify-between items-center flex-shrink-0"
            style={{ padding: '14px 18px 10px', fontSize: '13px', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--sub)' }}
          >
            <span>Scenes</span>
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center cursor-pointer text-[16px]"
              style={{ background: 'var(--s2)', border: '1px solid var(--s3)', color: 'var(--sub)' }}
              onClick={addScene}
            >
              +
            </div>
          </div>
          <div className="overflow-y-auto flex-1" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--s3) transparent' }}>
            {story && Object.values(story.scenes).map(sc => (
              <div
                key={sc.id}
                className="cursor-pointer transition-colors"
                style={{
                  padding: '13px 18px',
                  borderBottom: '1px solid var(--s2)',
                  background: selectedNodeId === sc.id ? 'var(--gold10)' : 'transparent',
                  borderLeft: selectedNodeId === sc.id ? '3px solid var(--gold)' : 'none',
                }}
                onClick={() => selectNode(sc.id)}
                onMouseEnter={e => e.currentTarget.style.background = selectedNodeId === sc.id ? 'var(--gold10)' : 'var(--s1)'}
                onMouseLeave={e => e.currentTarget.style.background = selectedNodeId === sc.id ? 'var(--gold10)' : 'transparent'}
              >
                <div className="text-[15px] font-medium" style={{ color: 'var(--text)', marginBottom: 3 }}>
                  {sc.title}{sc.id === story.startScene ? ' ★' : ''}
                </div>
                <div className="text-[12px]" style={{ color: 'var(--sub)' }}>
                  {sc.emotion} · {sc.clips.length} clip{sc.clips.length !== 1 ? 's' : ''} · -{sc.secondsBeforeEnd || 0}s · {sc.countdown || 0}s cd
                </div>
              </div>
            ))}
          </div>
        </div>

        <NodeGraph />
        {selectedNodeId && (
          <ResizablePanel width={panelWidth} onResize={setPanelWidth}>
            <EditPanel />
          </ResizablePanel>
        )}
      </div>

      {showCsvModal && <CsvImporter onClose={() => setShowCsvModal(false)} />}
      {showTtsModal && <TtsModal onClose={() => setShowTtsModal(false)} />}
    </div>
  )
}

function ResizablePanel({ width, onResize, children }) {
  const dragRef = useRef(null)
  const dragging = useRef(false)

  useEffect(() => {
    const handleMove = (e) => {
      if (!dragging.current) return
      const newW = window.innerWidth - e.clientX
      onResize(Math.max(300, Math.min(700, newW)))
    }
    const handleUp = () => { dragging.current = false; document.body.style.cursor = '' }
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
  }, [onResize])

  return (
    <div className="relative flex flex-shrink-0 z-10" style={{ width }}>
      {/* Drag handle */}
      <div
        ref={dragRef}
        className="absolute left-0 top-0 bottom-0 w-[5px] cursor-col-resize z-10 hover:bg-[rgba(201,169,110,0.2)] transition-colors"
        style={{ borderLeft: '1px solid var(--s3)' }}
        onMouseDown={() => { dragging.current = true; document.body.style.cursor = 'col-resize' }}
      />
      <div className="flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  )
}

function HeaderTextBtn({ icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '4px',
        background: 'none', border: 'none', color: '#a9a8ca',
        cursor: 'pointer', transition: 'color 0.15s',
        fontFamily: "'DM Sans', sans-serif", fontSize: '13px', fontWeight: 500,
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={e => e.currentTarget.style.color = '#c9a96e'}
      onMouseLeave={e => e.currentTarget.style.color = '#a9a8ca'}
    >
      {icon && <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>{icon}</span>}
      {label}
    </button>
  )
}

function HeaderIconBtn({ icon, title, onClick }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        color: '#928faa', transition: 'color 0.15s',
        display: 'flex', alignItems: 'center',
      }}
      onMouseEnter={e => e.currentTarget.style.color = '#f0ede6'}
      onMouseLeave={e => e.currentTarget.style.color = '#928faa'}
    >
      <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>{icon}</span>
    </button>
  )
}

function TtsModal({ onClose }) {
  const [apiKey, setApiKey] = useState(localStorage.getItem('elevenlabs_api_key') || '')
  const [showKey, setShowKey] = useState(false)
  const [personalVoices, setPersonalVoices] = useState([])
  const [libraryVoices, setLibraryVoices] = useState([])
  const [libraryTotal, setLibraryTotal] = useState(0)
  const [voicesLoaded, setVoicesLoaded] = useState(false)
  const [loadingLibrary, setLoadingLibrary] = useState(false)
  const [selectedVoice, setSelectedVoice] = useState('')
  const [filters, setFilters] = useState({ language: 'en', accent: '', gender: '', age: '', use_case: '' })
  const [generating, setGenerating] = useState(false)
  const [csvData, setCsvData] = useState([])
  const [dragging, setDragging] = useState(false)
  const [model, setModel] = useState('eleven_multilingual_v2')
  const [stability, setStability] = useState(0.5)
  const [similarity, setSimilarity] = useState(0.75)
  const [progress, setProgress] = useState({ current: 0, total: 0, scene: '', errors: 0 })
  const [error, setError] = useState('')
  const fileRef = useRef(null)

  const models = [
    { id: 'eleven_v3', name: 'Eleven v3 — Most Expressive' },
    { id: 'eleven_multilingual_v2', name: 'Eleven Multilingual v2 — Stable' },
    { id: 'eleven_flash_v2_5', name: 'Eleven Flash v2.5 — Low Latency' },
  ]

  // Filter options — languages use ISO codes, rest are ElevenLabs label values
  const LANG_OPTIONS = [
    { value: 'en', label: 'English' }, { value: 'es', label: 'Spanish' }, { value: 'fr', label: 'French' },
    { value: 'de', label: 'German' }, { value: 'it', label: 'Italian' }, { value: 'pt', label: 'Portuguese' },
    { value: 'pl', label: 'Polish' }, { value: 'hi', label: 'Hindi' }, { value: 'ja', label: 'Japanese' },
    { value: 'ko', label: 'Korean' }, { value: 'zh', label: 'Chinese' }, { value: 'ar', label: 'Arabic' },
    { value: 'nl', label: 'Dutch' }, { value: 'ru', label: 'Russian' }, { value: 'sv', label: 'Swedish' },
    { value: 'tr', label: 'Turkish' }, { value: 'id', label: 'Indonesian' }, { value: 'fil', label: 'Filipino' },
  ]
  const GENDER_OPTIONS = ['male', 'female']
  const AGE_OPTIONS = ['young', 'middle_aged', 'old']
  const ACCENT_OPTIONS = ['american', 'british', 'australian', 'irish', 'indian', 'african', 'canadian', 'scottish', 'latin american']
  const USE_CASE_OPTIONS = [
    { value: 'conversational', label: 'Conversational' },
    { value: 'narrative_story', label: 'Narration' },
    { value: 'characters_animation', label: 'Characters' },
    { value: 'social_media', label: 'Social Media' },
    { value: 'informative_educational', label: 'Educational' },
    { value: 'advertisement', label: 'Advertisement' },
    { value: 'entertainment_tv', label: 'Entertainment' },
  ]

  const fetchLibrary = useCallback(async (currentFilters) => {
    if (!apiKey) return
    setLoadingLibrary(true)
    try {
      const params = new URLSearchParams({ page_size: '100' })
      if (currentFilters.language) params.set('language', currentFilters.language)
      if (currentFilters.gender) params.set('gender', currentFilters.gender)
      if (currentFilters.age) params.set('age', currentFilters.age)
      if (currentFilters.accent) params.set('accent', currentFilters.accent)
      if (currentFilters.use_case) params.set('use_cases', currentFilters.use_case)
      const res = await fetch(`https://api.elevenlabs.io/v1/shared-voices?${params}`, {
        headers: { 'xi-api-key': apiKey }
      })
      const data = await res.json()
      const normalized = (data.voices || []).map(v => ({
        voice_id: v.voice_id,
        name: v.name,
        preview_url: v.preview_url,
        description: v.description || '',
        gender: v.gender || '',
        accent: v.accent || '',
        age: v.age || '',
        use_case: v.use_case || '',
        _source: 'library',
      }))
      setLibraryVoices(normalized)
      setLibraryTotal(data.total_count || normalized.length)
    } catch { /* silent */ }
    setLoadingLibrary(false)
  }, [apiKey])

  const fetchVoices = async () => {
    if (!apiKey) { setError('Enter API key first'); return }
    localStorage.setItem('elevenlabs_api_key', apiKey)
    setError('')
    try {
      // Personal voices
      const res = await fetch('https://api.elevenlabs.io/v1/voices', {
        headers: { 'xi-api-key': apiKey }
      })
      const data = await res.json()
      setPersonalVoices((data.voices || []).map(v => ({ ...v, _source: 'personal' })))
      setVoicesLoaded(true)
      // Shared library (with current filters)
      await fetchLibrary(filters)
    } catch (err) {
      setError(err.message)
    }
  }

  // Re-fetch library voices when filters change (only after initial load)
  useEffect(() => {
    if (!voicesLoaded) return
    fetchLibrary(filters)
  }, [filters, voicesLoaded, fetchLibrary])

  // Combined voice list: personal first, then library
  const allVoices = [
    ...personalVoices,
    ...libraryVoices.filter(lv => !personalVoices.some(pv => pv.voice_id === lv.voice_id)),
  ]

  const parseCsv = async (file) => {
    const Papa = (await import('papaparse')).default
    const text = await file.text()
    const { data } = Papa.parse(text, { header: true, skipEmptyLines: true })
    setCsvData(data)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && file.name.endsWith('.csv')) parseCsv(file)
  }

  const handleFileInput = (e) => {
    const file = e.target.files[0]
    if (file) parseCsv(file)
  }

  const previewVoice = async () => {
    if (!selectedVoice) return
    const voice = allVoices.find(v => v.voice_id === selectedVoice)
    if (voice?.preview_url) {
      new Audio(voice.preview_url).play()
    }
  }

  const generateAudio = async () => {
    if (!apiKey || !selectedVoice || csvData.length === 0) {
      setError('Need API key, voice, and CSV data')
      return
    }
    setGenerating(true)
    setError('')
    let completed = 0
    let errors = 0
    const total = csvData.filter(r => r.narration_script?.trim()).length
    setProgress({ current: 0, total, scene: '', errors: 0 })

    for (const row of csvData) {
      const script = row.narration_script?.trim()
      if (!script) continue
      const sceneId = row.scene_id?.trim() || `scene_${completed}`
      setProgress({ current: completed, total, scene: sceneId, errors })
      try {
        const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${selectedVoice}`, {
          method: 'POST',
          headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: script,
            model_id: model,
            voice_settings: { stability, similarity_boost: similarity }
          })
        })
        if (!res.ok) { errors++; continue }
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${sceneId}-a.mp3`
        a.click()
        URL.revokeObjectURL(url)
        completed++
      } catch { errors++ }
    }
    setProgress({ current: completed, total, scene: '', errors })
    setGenerating(false)
  }

  const setFilter = (key, value) => setFilters(f => ({ ...f, [key]: value }))

  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0

  const labelStyle = { color: 'var(--sub)', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600, fontFamily: "'DM Sans', sans-serif", marginBottom: '10px', display: 'block' }
  const sectionGap = { marginBottom: '28px' }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center" style={{ background: 'rgba(7,7,15,0.85)', backdropFilter: 'blur(10px)' }}>
      <div
        className="w-full max-w-[560px] overflow-y-auto hide-scrollbar"
        style={{
          background: 'var(--s1)', border: '1px solid var(--s3)', borderRadius: '24px',
          padding: '36px 40px', maxHeight: '90vh',
        }}
      >
        {/* Header */}
        <div className="flex justify-between items-center" style={{ marginBottom: '32px' }}>
          <h2 style={{ fontFamily: "'EB Garamond', serif", fontStyle: 'italic', fontSize: '26px', color: 'var(--text)', fontWeight: 400 }}>
            ElevenLabs TTS
          </h2>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--sub)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '8px', transition: 'color 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--sub)'}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '22px' }}>close</span>
          </button>
        </div>

        {/* API Key */}
        <div style={sectionGap}>
          <label style={labelStyle}>API Key</label>
          <div className="flex" style={{ gap: '10px' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <input
                className="cr-input"
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="xi-..."
                style={{ paddingRight: '40px' }}
              />
              <button
                onClick={() => setShowKey(!showKey)}
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mute)', display: 'flex' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>{showKey ? 'visibility_off' : 'visibility'}</span>
              </button>
            </div>
            <button
              onClick={fetchVoices}
              style={{
                background: 'transparent', border: '1px solid var(--gold)', borderRadius: '12px',
                color: 'var(--gold)', fontFamily: "'DM Sans', sans-serif", fontSize: '13px', fontWeight: 600,
                padding: '0 20px', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--gold)'; e.currentTarget.style.color = 'var(--bg)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--gold)' }}
            >
              Load Voices
            </button>
          </div>
        </div>

        {/* Voice */}
        {voicesLoaded && (
          <div style={sectionGap}>
            <label style={labelStyle}>Voice</label>

            {/* Filter chips row */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
              <FilterChip label="Language" value={filters.language} options={LANG_OPTIONS} onChange={v => setFilter('language', v)} />
              <FilterChip label="Accent" value={filters.accent} options={ACCENT_OPTIONS} onChange={v => setFilter('accent', v)} />
              <FilterChip label="Category" value={filters.use_case} options={USE_CASE_OPTIONS} onChange={v => setFilter('use_case', v)} />
              <FilterChip label="Gender" value={filters.gender} options={GENDER_OPTIONS} onChange={v => setFilter('gender', v)} />
              <FilterChip label="Age" value={filters.age} options={AGE_OPTIONS} onChange={v => setFilter('age', v)} />
            </div>

            {/* Voice count */}
            <div style={{ fontSize: '12px', color: 'var(--mute)', fontFamily: "'DM Sans', sans-serif", marginBottom: '8px' }}>
              {loadingLibrary ? 'Loading voices...' : (
                <>
                  {allVoices.length} voice{allVoices.length !== 1 ? 's' : ''}
                  {libraryTotal > allVoices.length ? ` (of ${libraryTotal.toLocaleString()} matching)` : ''}
                </>
              )}
            </div>

            <select
              className="cr-input"
              value={selectedVoice}
              onChange={e => setSelectedVoice(e.target.value)}
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='%23928faa'%3E%3Cpath d='M7 10l5 5 5-5z'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center', paddingRight: '36px',
              }}
            >
              <option value="">Select a voice...</option>
              {personalVoices.length > 0 && <option disabled style={{ fontWeight: 700 }}>--- My Voices ---</option>}
              {personalVoices.map(v => (
                <option key={v.voice_id} value={v.voice_id}>
                  {v.name}{v.labels?.description ? ` \u2014 ${v.labels.description}` : ''}
                </option>
              ))}
              {libraryVoices.length > 0 && <option disabled style={{ fontWeight: 700 }}>--- Voice Library ---</option>}
              {libraryVoices.filter(lv => !personalVoices.some(pv => pv.voice_id === lv.voice_id)).map(v => (
                <option key={v.voice_id} value={v.voice_id}>
                  {v.name}{v.description ? ` \u2014 ${v.description}` : ''}
                </option>
              ))}
            </select>
            {selectedVoice && (
              <button
                onClick={previewVoice}
                style={{
                  marginTop: '12px', display: 'inline-flex', alignItems: 'center', gap: '8px',
                  background: 'var(--s2)', border: '1px solid var(--s3)', borderRadius: '10px',
                  padding: '8px 16px', cursor: 'pointer', color: 'var(--sub)',
                  fontFamily: "'DM Sans', sans-serif", fontSize: '13px', transition: 'all 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--sub)'; e.currentTarget.style.color = 'var(--text)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--s3)'; e.currentTarget.style.color = 'var(--sub)' }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '16px', fontVariationSettings: "'FILL' 1" }}>play_arrow</span>
                Preview Voice
              </button>
            )}
          </div>
        )}

        {/* Narration Source — drag & drop */}
        <div style={sectionGap}>
          <label style={labelStyle}>Narration Source</label>
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            style={{
              border: `2px dashed ${dragging ? 'var(--gold)' : 'var(--s3)'}`,
              borderRadius: '16px', padding: '36px 24px', textAlign: 'center', cursor: 'pointer',
              background: dragging ? 'var(--gold10)' : 'transparent', transition: 'all 0.2s',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '28px', color: 'var(--mute)', display: 'block', marginBottom: '10px' }}>upload</span>
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '14px', color: 'var(--sub)' }}>
              Drop CSV or <span style={{ color: 'var(--gold)', textDecoration: 'underline', textUnderlineOffset: '3px' }}>click to browse</span>
            </span>
            <input ref={fileRef} type="file" accept=".csv" onChange={handleFileInput} style={{ display: 'none' }} />
          </div>

          {/* CSV loaded banner */}
          {csvData.length > 0 && (
            <div style={{
              marginTop: '14px', display: 'flex', alignItems: 'center', gap: '10px',
              background: 'var(--s2)', borderRadius: '12px', padding: '14px 16px',
              borderLeft: '3px solid #4ade80',
            }}>
              <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#4ade80', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span className="material-symbols-outlined" style={{ fontSize: '14px', color: '#07070f', fontVariationSettings: "'FILL' 1" }}>check</span>
              </span>
              <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '14px', color: 'var(--text)' }}>
                {csvData.filter(r => r.narration_script?.trim()).length} scenes with narration scripts found
              </span>
            </div>
          )}
        </div>

        {/* Generation Settings */}
        <div style={sectionGap}>
          <label style={{ ...labelStyle, marginBottom: '16px' }}>Generation Settings</label>

          {/* Model */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ ...labelStyle, fontSize: '10px', fontWeight: 700, marginBottom: '8px' }}>Model</label>
            <select
              className="cr-input"
              value={model}
              onChange={e => setModel(e.target.value)}
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='%23928faa'%3E%3Cpath d='M7 10l5 5 5-5z'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center', paddingRight: '36px',
              }}
            >
              {models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>

          {/* Sliders row */}
          <div style={{ display: 'flex', gap: '24px' }}>
            <SliderControl label="Stability" value={stability} onChange={setStability} />
            <SliderControl label="Similarity" value={similarity} onChange={setSimilarity} />
          </div>
        </div>

        {/* Progress (during/after generation) */}
        {progress.total > 0 && (
          <div style={{ marginBottom: '24px' }}>
            {generating && progress.scene && (
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '14px', color: 'var(--text)', marginBottom: '6px' }}>
                Generating scene {progress.current + 1} of {progress.total} — {progress.scene}...
              </div>
            )}
            {!generating && progress.current > 0 && (
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '14px', color: 'var(--text)', marginBottom: '6px' }}>
                Done! Generated {progress.current} audio files.
              </div>
            )}
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '12px', color: 'var(--sub)', marginBottom: '8px' }}>
              {progress.current} complete · {progress.errors} error{progress.errors !== 1 ? 's' : ''}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ flex: 1, height: '4px', borderRadius: '2px', background: 'var(--s3)', overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', borderRadius: '2px', background: 'var(--gold)', transition: 'width 0.3s var(--silk)' }} />
              </div>
              <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '13px', fontWeight: 600, color: 'var(--gold)', minWidth: '36px', textAlign: 'right' }}>{pct}%</span>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ marginBottom: '16px', fontSize: '13px', color: '#f97758', fontFamily: "'DM Sans', sans-serif" }}>
            {error}
          </div>
        )}

        {/* Generate button */}
        <button
          onClick={generateAudio}
          disabled={generating}
          style={{
            width: '100%', padding: '16px', borderRadius: '16px', border: 'none', cursor: generating ? 'default' : 'pointer',
            background: generating ? 'var(--s3)' : 'var(--gold)', color: generating ? 'var(--sub)' : 'var(--bg)',
            fontFamily: "'DM Sans', sans-serif", fontSize: '15px', fontWeight: 600, letterSpacing: '0.03em',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            transition: 'all 0.2s', opacity: generating ? 0.6 : 1,
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>download</span>
          {generating ? `Generating... ${pct}%` : 'Generate All Audio'}
        </button>
      </div>
    </div>
  )
}

function SliderControl({ label, value, onChange }) {
  const trackRef = useRef(null)

  const handlePointer = (e) => {
    const rect = trackRef.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    onChange(Math.round(x * 100) / 100)
  }

  const handleMouseDown = (e) => {
    handlePointer(e)
    const move = (ev) => handlePointer(ev)
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  return (
    <div style={{ flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
        <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '10px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--sub)' }}>{label}</span>
        <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: '13px', fontWeight: 600, color: 'var(--gold)' }}>{value}</span>
      </div>
      <div
        ref={trackRef}
        onMouseDown={handleMouseDown}
        style={{ position: 'relative', height: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
      >
        <div style={{ width: '100%', height: '4px', borderRadius: '2px', background: 'var(--s3)' }}>
          <div style={{ width: `${value * 100}%`, height: '100%', borderRadius: '2px', background: 'var(--gold25)' }} />
        </div>
        <div style={{
          position: 'absolute', left: `${value * 100}%`, top: '50%', transform: 'translate(-50%, -50%)',
          width: '14px', height: '14px', borderRadius: '50%', background: 'var(--gold)',
          boxShadow: '0 2px 8px rgba(201,169,110,0.4)',
        }} />
      </div>
    </div>
  )
}

function FilterChip({ label, value, options, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  // Normalize options to { value, label } format
  const items = options.map(o => typeof o === 'string' ? { value: o, label: o.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) } : o)

  const active = !!value
  const activeItem = items.find(i => i.value === value)
  const displayValue = activeItem?.label || (value ? value.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '')

  const chipStyle = {
    display: 'inline-flex', alignItems: 'center', gap: '5px', cursor: 'pointer',
    padding: '5px 12px', borderRadius: '9999px', fontSize: '12px',
    fontFamily: "'DM Sans', sans-serif", fontWeight: 500, whiteSpace: 'nowrap',
    border: active ? '1px solid var(--gold)' : '1px solid var(--s3)',
    background: active ? 'var(--gold10)' : 'transparent',
    color: active ? 'var(--gold)' : 'var(--sub)',
    transition: 'all 0.15s',
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button style={chipStyle} onClick={() => setOpen(!open)}>
        {active ? (
          <>
            {label}: {displayValue}
            <span
              className="material-symbols-outlined"
              style={{ fontSize: '14px', marginLeft: '2px' }}
              onClick={e => { e.stopPropagation(); onChange(''); setOpen(false) }}
            >close</span>
          </>
        ) : (
          <>
            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>add</span>
            {label}
          </>
        )}
      </button>

      {open && items.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: '4px', zIndex: 30,
          background: 'var(--s1)', border: '1px solid var(--s3)', borderRadius: '12px',
          padding: '4px', minWidth: '160px', maxHeight: '220px', overflowY: 'auto',
          boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
        }} className="hide-scrollbar">
          {active && (
            <button
              onClick={() => { onChange(''); setOpen(false) }}
              style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px',
                background: 'none', border: 'none', cursor: 'pointer', borderRadius: '8px',
                fontSize: '13px', fontFamily: "'DM Sans', sans-serif", color: 'var(--sub)',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--s2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >All</button>
          )}
          {items.map(item => {
            const selected = item.value === value
            return (
              <button
                key={item.value}
                onClick={() => { onChange(item.value); setOpen(false) }}
                style={{
                  display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px',
                  background: selected ? 'var(--gold10)' : 'none', border: 'none', cursor: 'pointer', borderRadius: '8px',
                  fontSize: '13px', fontFamily: "'DM Sans', sans-serif",
                  color: selected ? 'var(--gold)' : 'var(--text)', fontWeight: selected ? 600 : 400,
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { if (!selected) e.currentTarget.style.background = 'var(--s2)' }}
                onMouseLeave={e => { if (!selected) e.currentTarget.style.background = 'none' }}
              >{item.label}</button>
            )
          })}
        </div>
      )}
    </div>
  )
}
