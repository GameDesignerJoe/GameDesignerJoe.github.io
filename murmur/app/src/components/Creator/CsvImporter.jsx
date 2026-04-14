import { useState } from 'react'
import { useStore } from '../../store'

export default function CsvImporter({ onClose }) {
  const setCreatorStory = useStore(s => s.setCreatorStory)
  const addStory = useStore(s => s.addStory)
  const [status, setStatus] = useState('')
  const [storyTitle, setStoryTitle] = useState('Imported Story')

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setStatus('Parsing CSV…')

    const Papa = (await import('papaparse')).default
    const text = await file.text()
    const { data, errors } = Papa.parse(text, { header: true, skipEmptyLines: true })

    if (errors.length > 0) {
      setStatus(`Parse errors: ${errors.map(e => e.message).join(', ')}`)
      return
    }

    // Build story from CSV rows
    const storyId = storyTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '')

    const scenes = {}
    let startScene = null

    data.forEach(row => {
      const sceneId = row.scene_id?.trim()
      if (!sceneId) return

      const scene = {
        id: sceneId,
        title: row.title?.trim() || sceneId,
        emotion: row.emotion?.trim() || 'curious',
        bgKey: 'a',
        bgImage: null,
        clips: [],
        secondsBeforeEnd: parseInt(row.seconds_before_end) || 5,
        defaultChoice: row.default_choice !== undefined && row.default_choice !== '' ? parseInt(row.default_choice) : 0,
        countdown: parseInt(row.countdown_seconds) || 4,
        choices: [],
      }

      // Add choices
      if (row.choice_1_text?.trim() && row.choice_1_target?.trim()) {
        scene.choices.push({ text: row.choice_1_text.trim(), target: row.choice_1_target.trim() })
      }
      if (row.choice_2_text?.trim() && row.choice_2_target?.trim()) {
        scene.choices.push({ text: row.choice_2_text.trim(), target: row.choice_2_target.trim() })
      }

      // No choices = end node
      if (scene.choices.length === 0) {
        scene.defaultChoice = null
        scene.countdown = 0
        scene.secondsBeforeEnd = 0
      }

      scenes[sceneId] = scene

      // Mark start scene
      if (row.is_start?.trim()?.toUpperCase() === 'TRUE') {
        startScene = sceneId
      }
    })

    if (!startScene && Object.keys(scenes).length > 0) {
      startScene = Object.keys(scenes)[0]
    }

    const story = {
      id: storyId,
      title: storyTitle,
      tagline: '',
      description: '',
      tags: [],
      bg: 'linear-gradient(160deg,#0a0a0a 0%,#1a1208 100%)',
      bgs: {
        a: 'linear-gradient(160deg,#0a0a0a,#1a1208)',
        b: 'linear-gradient(160deg,#080808,#100c04)',
        c: 'linear-gradient(160deg,#0d0405,#1a0808)',
        d: 'linear-gradient(160deg,#050505,#080808)',
      },
      narrator: { name: 'Narrator', emoji: '🎭' },
      duration: `~${Math.ceil(Object.keys(scenes).length * 0.8)} min`,
      paths: 1,
      startScene,
      scenes,
    }

    addStory(story)
    setCreatorStory(story)
    setStatus(`Imported ${Object.keys(scenes).length} scenes! Story loaded into editor.`)

    setTimeout(() => onClose(), 1500)
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center" style={{ background: 'rgba(7,7,15,0.85)', backdropFilter: 'blur(10px)' }}>
      <div className="w-full max-w-md rounded-3xl p-8" style={{ background: 'var(--s1)', border: '1px solid var(--s3)' }}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="font-display italic text-2xl">Import CSV</h2>
          <span className="cursor-pointer text-xl" style={{ color: 'var(--mute)' }} onClick={onClose}>×</span>
        </div>

        <div className="mb-4">
          <label className="block text-[10px] tracking-[0.12em] uppercase mb-2" style={{ color: 'var(--mute)' }}>Story Title</label>
          <input
            className="cr-input w-full"
            value={storyTitle}
            onChange={e => setStoryTitle(e.target.value)}
            placeholder="My Story"
          />
        </div>

        <div className="mb-4">
          <label className="block text-[10px] tracking-[0.12em] uppercase mb-2" style={{ color: 'var(--mute)' }}>CSV File</label>
          <div className="text-[10px] mb-2" style={{ color: 'var(--mute)', lineHeight: 1.4 }}>
            Expected columns: scene_id, title, narration_script, choice_1_text, choice_1_target, choice_2_text, choice_2_target, emotion, is_start, default_choice, seconds_before_end, countdown_seconds, notes
          </div>
          <input type="file" accept=".csv" onChange={handleFileUpload} className="text-sm" style={{ color: 'var(--sub)' }} />
        </div>

        {status && (
          <div className="mt-4 text-xs p-3 rounded-xl" style={{ background: 'var(--s2)', color: 'var(--sub)' }}>
            {status}
          </div>
        )}
      </div>
    </div>
  )
}
