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
      {/* Header */}
      <div
        className="flex items-center gap-3 flex-shrink-0"
        style={{
          height: 64,
          minHeight: 'calc(64px + env(safe-area-inset-top))',
          paddingTop: 'env(safe-area-inset-top)',
          padding: '0 20px',
          borderBottom: '1px solid var(--s3)',
        }}
      >
        <div
          className="font-display italic font-light text-xl tracking-wider cursor-pointer flex-shrink-0"
          style={{ color: 'var(--sub)', marginRight: '8px' }}
          onClick={() => setView('library')}
        >
          ‹ Murmur
        </div>
        <div className="w-px h-7 flex-shrink-0" style={{ background: 'var(--s3)' }} />
        <div className="font-display italic text-xl flex-1 truncate" style={{ color: 'var(--text)' }}>
          {story?.title || 'Story Editor'}
        </div>
        <select
          className="text-[13px] tracking-[0.06em] rounded-full px-4 py-2 cursor-pointer outline-none max-w-[180px]"
          style={{
            background: 'var(--s2)',
            border: '1px solid var(--s3)',
            color: 'var(--sub)',
            appearance: 'none',
          }}
          value={story?.id || ''}
          onChange={e => {
            const found = stories.find(s => s.id === e.target.value)
            if (found) setCreatorStory(found)
          }}
        >
          {stories.map(s => (
            <option key={s.id} value={s.id}>{s.title}</option>
          ))}
        </select>
        <CreatorBtn onClick={addScene}>+ Scene</CreatorBtn>
        <CreatorBtn onClick={importJson}>Import JSON</CreatorBtn>
        <CreatorBtn onClick={() => setShowCsvModal(true)}>Import CSV</CreatorBtn>
        <CreatorBtn onClick={() => setShowTtsModal(true)}>🔊 TTS</CreatorBtn>
        <CreatorBtn primary onClick={exportStory}>Export</CreatorBtn>
      </div>

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

function CreatorBtn({ children, primary, onClick }) {
  return (
    <button
      className="text-[13px] tracking-[0.06em] uppercase rounded-full px-4 py-2 cursor-pointer transition-all flex-shrink-0 whitespace-nowrap"
      style={{
        color: primary ? 'var(--bg)' : 'var(--text)',
        background: primary ? 'var(--gold)' : 'var(--s2)',
        border: `1px solid ${primary ? 'var(--gold)' : 'var(--s3)'}`,
      }}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function TtsModal({ onClose }) {
  const creator = useStore(s => s.creator)
  const [apiKey, setApiKey] = useState(localStorage.getItem('elevenlabs_api_key') || '')
  const [voices, setVoices] = useState([])
  const [selectedVoice, setSelectedVoice] = useState('')
  const [status, setStatus] = useState('')
  const [generating, setGenerating] = useState(false)
  const [csvFile, setCsvFile] = useState(null)
  const [csvData, setCsvData] = useState([])

  const fetchVoices = async () => {
    if (!apiKey) { setStatus('Enter API key first'); return }
    localStorage.setItem('elevenlabs_api_key', apiKey)
    setStatus('Fetching voices…')
    try {
      const res = await fetch('https://api.elevenlabs.io/v1/voices', {
        headers: { 'xi-api-key': apiKey }
      })
      const data = await res.json()
      setVoices(data.voices || [])
      setStatus(`Found ${data.voices?.length || 0} voices`)
    } catch (err) {
      setStatus('Error: ' + err.message)
    }
  }

  const handleCsvUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setCsvFile(file)
    const Papa = (await import('papaparse')).default
    const text = await file.text()
    const { data } = Papa.parse(text, { header: true, skipEmptyLines: true })
    setCsvData(data)
    setStatus(`Loaded ${data.length} scenes from CSV`)
  }

  const generateAudio = async () => {
    if (!apiKey || !selectedVoice || csvData.length === 0) {
      setStatus('Need API key, voice, and CSV data')
      return
    }
    setGenerating(true)
    let completed = 0
    for (const row of csvData) {
      const script = row.narration_script?.trim()
      if (!script) continue
      const sceneId = row.scene_id?.trim()
      setStatus(`Generating ${sceneId}… (${completed}/${csvData.length})`)
      try {
        const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${selectedVoice}`, {
          method: 'POST',
          headers: {
            'xi-api-key': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: script,
            model_id: 'eleven_multilingual_v2',
            voice_settings: { stability: 0.5, similarity_boost: 0.75 }
          })
        })
        if (!res.ok) {
          setStatus(`Error on ${sceneId}: ${res.statusText}`)
          continue
        }
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${sceneId}-a.mp3`
        a.click()
        URL.revokeObjectURL(url)
        completed++
      } catch (err) {
        setStatus(`Error on ${sceneId}: ${err.message}`)
      }
    }
    setStatus(`Done! Generated ${completed} audio files.`)
    setGenerating(false)
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center" style={{ background: 'rgba(7,7,15,0.85)', backdropFilter: 'blur(10px)' }}>
      <div className="w-full max-w-lg rounded-3xl p-8" style={{ background: 'var(--s1)', border: '1px solid var(--s3)' }}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="font-display italic text-2xl">ElevenLabs TTS</h2>
          <span className="cursor-pointer text-xl" style={{ color: 'var(--sub)' }} onClick={onClose}>×</span>
        </div>

        <div className="mb-5">
          <label className="block text-[13px] tracking-[0.08em] uppercase mb-2" style={{ color: 'var(--sub)' }}>API Key</label>
          <div className="flex gap-2">
            <input className="cr-input flex-1" type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="xi-…" />
            <button className="cr-btn-action" onClick={fetchVoices}>Load Voices</button>
          </div>
        </div>

        {voices.length > 0 && (
          <div className="mb-5">
            <label className="block text-[13px] tracking-[0.08em] uppercase mb-2" style={{ color: 'var(--sub)' }}>Voice</label>
            <select className="cr-input w-full" value={selectedVoice} onChange={e => setSelectedVoice(e.target.value)}>
              <option value="">Select a voice…</option>
              {voices.map(v => <option key={v.voice_id} value={v.voice_id}>{v.name}</option>)}
            </select>
          </div>
        )}

        <div className="mb-5">
          <label className="block text-[13px] tracking-[0.08em] uppercase mb-2" style={{ color: 'var(--sub)' }}>CSV with narration scripts</label>
          <input type="file" accept=".csv" onChange={handleCsvUpload} className="text-sm" style={{ color: 'var(--sub)' }} />
          {csvData.length > 0 && (
            <div className="mt-2 text-[13px]" style={{ color: 'var(--sub)' }}>{csvData.length} scenes loaded</div>
          )}
        </div>

        <button
          className="w-full py-3 rounded-2xl text-[15px] font-medium cursor-pointer transition-all active:scale-[0.97]"
          style={{ background: generating ? 'var(--s3)' : 'var(--gold)', color: generating ? 'var(--sub)' : 'var(--bg)', border: 'none' }}
          onClick={generateAudio}
          disabled={generating}
        >
          {generating ? 'Generating…' : 'Generate All Audio'}
        </button>

        {status && <div className="mt-3 text-[13px]" style={{ color: 'var(--sub)' }}>{status}</div>}
      </div>
    </div>
  )
}
