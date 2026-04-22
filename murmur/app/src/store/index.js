import { create } from 'zustand'
import { SmartShuffle } from '../engine/SmartShuffle'
import { loadStoryAudio } from '../engine/AudioStore'
import { loadStoryImages } from '../engine/ImageStore'

// Reserved choice.target value that means "exit the player and return to the
// library (or creator, if launched from there)". Chosen with leading/trailing
// underscores so it can't collide with a user-authored scene ID.
export const END_STORY = '__end__'

// ── Persistence helpers ──
const STORIES_KEY = 'murmur_stories'

function loadStories() {
  try {
    const saved = localStorage.getItem(STORIES_KEY)
    if (saved) return JSON.parse(saved)
  } catch { /* corrupt data, fall through */ }
  return null
}

// Image fields that may hold a blob: URL during a session but must be stripped
// before localStorage serialization (blobs don't survive refresh).
const IMAGE_FIELDS = new Set(['coverImage', 'defaultBgImage', 'bgImage'])

function saveStories(stories) {
  try {
    const clean = JSON.parse(JSON.stringify(stories, (key, val) => {
      // Strip blob URLs from audio clip arrays
      if (key === 'clips' && Array.isArray(val)) return val.filter(c => !c.startsWith('blob:'))
      // Strip blob URLs from image fields (they're re-created from IndexedDB on load)
      if (IMAGE_FIELDS.has(key) && typeof val === 'string' && val.startsWith('blob:')) return null
      // Strip blob URLs from narrator.portraits[emotion]
      if (key === 'portraits' && val && typeof val === 'object') {
        const out = {}
        for (const [k, v] of Object.entries(val)) {
          out[k] = (typeof v === 'string' && v.startsWith('blob:')) ? null : v
        }
        return out
      }
      return val
    }))
    localStorage.setItem(STORIES_KEY, JSON.stringify(clean))
  } catch (e) {
    console.warn('[Murmur] Failed to save stories:', e.message)
  }
}

/** Upsert a story into the stories array (add if new, replace if exists) */
function upsertStory(stories, edited) {
  const exists = stories.some(st => st.id === edited.id)
  return exists
    ? stories.map(st => st.id === edited.id ? edited : st)
    : [...stories, edited]
}

// Demo stories — same as prototype
const DEMO_STORIES = [
  {
    id: 'lighthouse',
    title: "The Lighthouse Keeper's Daughter",
    tagline: 'Some secrets are worth keeping.',
    description: "On a fog-blanketed coast, you've arrived at your late father's lighthouse. His journals speak of a forbidden love, a hidden room, and a warning never to light the lamp on moonless nights. Tonight, the moon will not rise.",
    tags: ['mystery', 'romance', 'gothic'],
    bg: 'linear-gradient(160deg,#0c1a2a 0%,#193558 40%,#27607e 70%,#09121b 100%)',
    bgs: { a: 'linear-gradient(160deg,#0c1a2a,#193558)', b: 'linear-gradient(160deg,#0a1520,#192d3e)', c: 'linear-gradient(160deg,#18061a,#3a1240)', d: 'linear-gradient(160deg,#07090e,#101825)' },
    coverImage: '/stories/lighthouse/images/cover.jpg',
    narrator: {
      name: 'Eleanor',
      emoji: '🕯️',
      portraits: {
        curious: '/stories/lighthouse/images/portraits/curious.jpg',
        afraid: '/stories/lighthouse/images/portraits/curious.jpg',
        happy: '/stories/lighthouse/images/portraits/curious.jpg',
        sad: '/stories/lighthouse/images/portraits/curious.jpg',
        determined: '/stories/lighthouse/images/portraits/curious.jpg',
      }
    },
    duration: '~12 min', paths: 4, startScene: 'start',
    scenes: {
      start: { id: 'start', title: 'The Arrival', emotion: 'curious', bgKey: 'a', bgImage: null, clips: ['lighthouse/start-a.mp3', 'lighthouse/start-b.mp3'], secondsBeforeEnd: 6, defaultChoice: 0, countdown: 10, choices: [{ text: 'Enter through the heavy iron door…', target: 'hall' }, { text: "Circle to the keeper's cottage…", target: 'cottage' }] },
      hall: { id: 'hall', title: 'The Front Hall', emotion: 'afraid', bgKey: 'b', bgImage: null, clips: ['lighthouse/hall.mp3'], secondsBeforeEnd: 7, defaultChoice: 0, countdown: 10, choices: [{ text: 'Climb the spiral stair…', target: 'lamp' }, { text: 'Search the roll-top desk…', target: 'study' }, { text: 'Step back outside and listen…', target: 'shore' }] },
      cottage: { id: 'cottage', title: "The Keeper's Cottage", emotion: 'curious', bgKey: 'b', bgImage: null, clips: ['lighthouse/cottage.mp3'], secondsBeforeEnd: 5, defaultChoice: 0, countdown: 10, choices: [{ text: 'Open the old journal on the table…', target: 'study' }, { text: 'Follow the stone path to the shore…', target: 'shore' }] },
      lamp: { id: 'lamp', title: 'The Lamp Room', emotion: 'afraid', bgKey: 'c', bgImage: null, clips: ['lighthouse/lamp-a.mp3', 'lighthouse/lamp-b.mp3'], secondsBeforeEnd: 6, defaultChoice: 1, countdown: 10, choices: [{ text: 'Reach for the brass ignition lever…', target: 'end' }, { text: 'Leave it dark and descend…', target: 'end' }] },
      study: { id: 'study', title: 'The Study', emotion: 'sad', bgKey: 'b', bgImage: null, clips: ['lighthouse/study.mp3'], secondsBeforeEnd: 5, defaultChoice: 0, countdown: 10, choices: [{ text: 'Feed the letter to the fireplace…', target: 'end' }, { text: 'Keep it and climb to the lamp room…', target: 'lamp' }] },
      shore: { id: 'shore', title: 'The Shore', emotion: 'determined', bgKey: 'c', bgImage: null, clips: ['lighthouse/shore-a.mp3', 'lighthouse/shore-b.mp3', 'lighthouse/shore-c.mp3'], secondsBeforeEnd: 7, defaultChoice: 0, countdown: 10, choices: [{ text: 'Call out across the water…', target: 'end' }, { text: 'Wade in toward the lights…', target: 'end' }] },
      end: { id: 'end', title: 'Before Dawn', emotion: 'sad', bgKey: 'd', bgImage: null, clips: ['lighthouse/end.mp3'], secondsBeforeEnd: 0, defaultChoice: null, countdown: 0, choices: [] }
    }
  },
  {
    id: 'train',
    title: 'The Last Train to Nowhere',
    tagline: "You can't outrun what you've left behind.",
    description: "You board a late-night train with no clear destination — only the need to disappear. But the man in the next seat knows your name. The woman in the dining car has your photograph. And the conductor keeps calling you by someone else's name entirely.",
    tags: ['thriller', 'surreal', 'suspense'],
    bg: 'linear-gradient(160deg,#1a0e04 0%,#3c1f0e 45%,#180900 100%)',
    coverImage: '/stories/train/images/cover.jpg',
    bgs: { a: 'linear-gradient(160deg,#1a0e04,#2d1a08)', b: 'linear-gradient(160deg,#100b03,#1a1204)', c: 'linear-gradient(160deg,#1e0404,#3a1010)', d: 'linear-gradient(160deg,#040406,#0b0b12)' },
    narrator: { name: 'The Passenger', emoji: '🎫' },
    duration: '~10 min', paths: 4, startScene: 'start',
    scenes: {
      start: { id: 'start', title: 'Car Seven', emotion: 'curious', bgKey: 'a', bgImage: null, clips: ['train/start.mp3'], secondsBeforeEnd: 6, defaultChoice: 0, countdown: 10, choices: [{ text: 'Ask the man who knows your name…', target: 'man' }, { text: 'Feign sleep and watch through half-closed eyes…', target: 'sleep' }, { text: 'Walk through to the dining car…', target: 'dining' }] },
      man: { id: 'man', title: 'The Man in Seat Nine', emotion: 'afraid', bgKey: 'b', bgImage: null, clips: ['train/man.mp3'], secondsBeforeEnd: 5, defaultChoice: 1, countdown: 10, choices: [{ text: 'Tell him the truth…', target: 'end' }, { text: 'Give him the name on your forged papers…', target: 'conductor' }] },
      sleep: { id: 'sleep', title: 'Feigning Sleep', emotion: 'determined', bgKey: 'b', bgImage: null, clips: ['train/sleep-a.mp3', 'train/sleep-b.mp3'], secondsBeforeEnd: 5, defaultChoice: 0, countdown: 10, choices: [{ text: 'Open one eye when footsteps pass…', target: 'conductor' }, { text: 'Hold until the train slows…', target: 'end' }] },
      dining: { id: 'dining', title: 'The Dining Car', emotion: 'curious', bgKey: 'b', bgImage: null, clips: ['train/dining.mp3'], secondsBeforeEnd: 5, defaultChoice: 0, countdown: 10, choices: [{ text: 'Ask her where she got the photograph…', target: 'conductor' }, { text: 'Sit across from her and say nothing…', target: 'conductor' }] },
      conductor: { id: 'conductor', title: 'The Conductor', emotion: 'afraid', bgKey: 'c', bgImage: null, clips: ['train/conductor.mp3'], secondsBeforeEnd: 6, defaultChoice: 0, countdown: 10, choices: [{ text: 'Show him your ticket and hold his gaze…', target: 'end' }, { text: 'Pull the emergency brake…', target: 'end' }] },
      end: { id: 'end', title: 'The Station', emotion: 'determined', bgKey: 'd', bgImage: null, clips: ['train/end.mp3'], secondsBeforeEnd: 0, defaultChoice: null, countdown: 0, choices: [] }
    }
  },
  {
    id: 'cartographer',
    title: "The Cartographer's Wife",
    tagline: 'Every map is a love letter.',
    description: "You are Theodora Voss, naturalist and accidental cartographer. Your ship has stopped at an island on no known chart. Edmund is weeks behind you. Your journal is nearly full. You have one afternoon before the tide turns — and something on this island does not want you to leave.",
    tags: ['adventure', 'historical', 'romance'],
    bg: 'linear-gradient(160deg,#1a1203 0%,#3c2c0d 40%,#281e07 80%,#090806 100%)',
    coverImage: '/stories/cartographer/images/cover.jpg',
    bgs: { a: 'linear-gradient(160deg,#1a1503,#2e2410)', b: 'linear-gradient(160deg,#0e1a08,#192d10)', c: 'linear-gradient(160deg,#1a0a0a,#2d1515)', d: 'linear-gradient(160deg,#090904,#14140a)' },
    narrator: { name: 'Theodora', emoji: '🗺️' },
    duration: '~11 min', paths: 3, startScene: 'start',
    scenes: {
      start: { id: 'start', title: 'The Unmarked Shore', emotion: 'curious', bgKey: 'a', bgImage: null, clips: ['cartographer/start.mp3'], secondsBeforeEnd: 6, defaultChoice: 0, countdown: 10, choices: [{ text: 'Follow the sound of fresh water inland…', target: 'spring' }, { text: 'Begin sketching the shape of the coast…', target: 'survey' }, { text: 'Investigate the ruins on the ridge above…', target: 'ruins' }] },
      spring: { id: 'spring', title: 'The Hidden Spring', emotion: 'happy', bgKey: 'b', bgImage: null, clips: ['cartographer/spring.mp3'], secondsBeforeEnd: 5, defaultChoice: 0, countdown: 10, choices: [{ text: 'Write Edmund a note and leave it in the stones…', target: 'end' }, { text: 'Press deeper into the green…', target: 'forest' }] },
      survey: { id: 'survey', title: 'The Survey', emotion: 'determined', bgKey: 'b', bgImage: null, clips: ['cartographer/survey.mp3'], secondsBeforeEnd: 5, defaultChoice: 0, countdown: 10, choices: [{ text: 'Mark it, title it, and sign your name…', target: 'end' }, { text: 'Turn at the sound behind you…', target: 'forest' }] },
      ruins: { id: 'ruins', title: 'The Ruins', emotion: 'afraid', bgKey: 'c', bgImage: null, clips: ['cartographer/ruins.mp3'], secondsBeforeEnd: 5, defaultChoice: 1, countdown: 10, choices: [{ text: 'Step inside…', target: 'forest' }, { text: 'Back away slowly into the light…', target: 'spring' }] },
      forest: { id: 'forest', title: 'Something Moves', emotion: 'afraid', bgKey: 'c', bgImage: null, clips: ['cartographer/forest-a.mp3', 'cartographer/forest-b.mp3'], secondsBeforeEnd: 5, defaultChoice: 0, countdown: 10, choices: [{ text: 'Stand still and let it come to you…', target: 'end' }, { text: 'Run for the ship…', target: 'end' }] },
      end: { id: 'end', title: 'The Tide Turns', emotion: 'sad', bgKey: 'd', bgImage: null, clips: ['cartographer/end.mp3'], secondsBeforeEnd: 0, defaultChoice: null, countdown: 0, choices: [] }
    }
  }
]

export const useStore = create((set, get) => ({
  // View state
  view: 'library', // library | detail | player | creator
  setView: (view) => set({ view }),

  // Stories (persisted to localStorage)
  stories: loadStories() || DEMO_STORIES,

  // Merge stories fetched from the stories manifest (public/stories/manifest.json).
  // - Stories NOT in localStorage are added wholesale (new discovery).
  // - Stories ALREADY in localStorage get their story-level metadata refreshed
  //   from the disk JSON (narrator, portraits, scenes' emotions, coverImage, etc.)
  //   so that changes made to the JSON via scripts or Save-to-Project are picked up
  //   even if the user already has the story in localStorage.
  mergeManifestStories: (fetched) => set(s => {
    const byId = Object.fromEntries(s.stories.map(st => [st.id, st]))
    let changed = false

    for (const disk of fetched) {
      const local = byId[disk.id]
      if (!local) {
        // Brand-new story — add it
        byId[disk.id] = disk
        changed = true
      } else {
        // Existing story — refresh key fields from the disk version.
        // This keeps localStorage edits for fields the user is actively changing
        // (like scene scripts) while picking up narrator, portraits, emotions,
        // cover/bg image paths, etc.
        const merged = { ...local }

        // Story-level fields: always take disk if present
        if (disk.narrator) merged.narrator = { ...local.narrator, ...disk.narrator }
        if (disk.coverImage) merged.coverImage = disk.coverImage
        if (disk.defaultBgImage) merged.defaultBgImage = disk.defaultBgImage
        if (disk.title) merged.title = disk.title
        if (disk.tagline) merged.tagline = disk.tagline
        if (disk.description) merged.description = disk.description
        if (disk.tags) merged.tags = disk.tags
        if (disk.startScene) merged.startScene = disk.startScene
        if (disk.duration) merged.duration = disk.duration
        if (disk.paths) merged.paths = disk.paths

        // Per-scene: refresh emotion + bgImage from disk
        if (disk.scenes && merged.scenes) {
          const newScenes = { ...merged.scenes }
          for (const [sid, diskScene] of Object.entries(disk.scenes)) {
            if (newScenes[sid]) {
              newScenes[sid] = { ...newScenes[sid], emotion: diskScene.emotion }
              if (diskScene.bgImage) newScenes[sid].bgImage = diskScene.bgImage
            } else {
              newScenes[sid] = diskScene // new scene from disk
            }
          }
          merged.scenes = newScenes
        }

        byId[disk.id] = merged
        changed = true
      }
    }

    if (!changed) return {}
    const stories = Object.values(byId)
    saveStories(stories)
    return { stories }
  }),

  addStory: (story) => set(s => {
    const stamped = { ...story, updatedAt: Date.now() }
    const stories = [...s.stories, stamped]
    saveStories(stories)
    return { stories }
  }),
  deleteStory: (storyId) => set(s => {
    const stories = s.stories.filter(st => st.id !== storyId)
    saveStories(stories)
    localStorage.removeItem('murmur_' + storyId)
    return { stories }
  }),
  setStoryHidden: (storyId, hidden) => set(s => {
    const stories = s.stories.map(st => st.id === storyId ? { ...st, hidden: !!hidden } : st)
    saveStories(stories)
    return { stories }
  }),

  // Hidden-stories toggle (persisted to localStorage)
  showHiddenStories: (() => { try { return localStorage.getItem('murmur_show_hidden') === '1' } catch { return false } })(),
  setShowHiddenStories: (v) => {
    try { localStorage.setItem('murmur_show_hidden', v ? '1' : '0') } catch {}
    set({ showHiddenStories: !!v })
  },

  // Creator mode — gates the editor, API keys, and other authoring features.
  // Hidden behind the same invisible settings tab as Show Hidden Stories.
  creatorMode: (() => { try { return localStorage.getItem('murmur_creator_mode') === '1' } catch { return false } })(),
  setCreatorMode: (v) => {
    try { localStorage.setItem('murmur_creator_mode', v ? '1' : '0') } catch {}
    set({ creatorMode: !!v })
  },

  // Active story index (tracks which card is visible in library scroll)
  activeStoryIndex: 0,
  setActiveStoryIndex: (idx) => set({ activeStoryIndex: idx }),

  // Selected story (for detail view)
  selectedStory: null,
  selectStory: (story) => set({ selectedStory: story }),

  // Player state
  player: {
    story: null,
    sceneId: null,
    history: [],
    shufflers: {},
    returnTo: 'library', // where to go when closing the player
    // Bumps on every goToScene so self-loops re-trigger the Player's scene
    // effect (its sceneId dep wouldn't change otherwise).
    playTick: 0,
  },

  launchStory: async (story, sceneId, history = []) => {
    // Restore audio from IndexedDB for any scenes with missing clips
    try {
      const blobs = await loadStoryAudio(story.id)
      const blobIds = Object.keys(blobs)
      if (blobIds.length > 0) {
        const scenes = { ...story.scenes }
        blobIds.forEach(sid => {
          const scene = scenes[sid]
          if (scene && (scene.clips.length === 0 || scene.clips.every(c => c.startsWith('blob:')))) {
            scenes[sid] = { ...scene, clips: [URL.createObjectURL(blobs[sid])] }
          }
        })
        story = { ...story, scenes }
      }
    } catch (e) {
      console.warn('[Murmur] Failed to restore audio on launch:', e.message)
    }

    // Restore generated images from IndexedDB (cover, default-bg, per-scene bg) for rendering
    try {
      const imgBlobs = await loadStoryImages(story.id)
      if (Object.keys(imgBlobs).length > 0) {
        const patched = { ...story }
        if (imgBlobs['cover'] && !patched.coverImage) {
          patched.coverImage = URL.createObjectURL(imgBlobs['cover'])
        }
        if (imgBlobs['default-bg'] && !patched.defaultBgImage) {
          patched.defaultBgImage = URL.createObjectURL(imgBlobs['default-bg'])
        }
        // Per-scene backgrounds
        let scenesTouched = false
        const newScenes = { ...patched.scenes }
        for (const [slot, blob] of Object.entries(imgBlobs)) {
          if (!slot.startsWith('scene/')) continue
          const sceneId = slot.slice(6)
          const sc = newScenes[sceneId]
          if (sc && !sc.bgImage) {
            newScenes[sceneId] = { ...sc, bgImage: URL.createObjectURL(blob) }
            scenesTouched = true
          }
        }
        if (scenesTouched) patched.scenes = newScenes
        story = patched
      }
    } catch (e) {
      console.warn('[Murmur] Failed to restore images on launch:', e.message)
    }

    const shufflers = {}
    Object.values(story.scenes).forEach(sc => {
      shufflers[sc.id] = new SmartShuffle(sc.clips)
    })
    // Remember which view launched the player so X goes back there
    const returnTo = get().view === 'creator' ? 'creator' : 'library'
    set({
      view: 'player',
      player: { story, sceneId, history: [...history], shufflers, returnTo, playTick: 0 },
    })
  },

  goToScene: (sceneId) => set(s => {
    const history = [...s.player.history]
    if (!history.includes(sceneId)) history.push(sceneId)
    const newPlayer = { ...s.player, sceneId, history, playTick: (s.player.playTick || 0) + 1 }
    // Save to localStorage
    if (s.player.story) {
      localStorage.setItem(
        'murmur_' + s.player.story.id,
        JSON.stringify({ sceneId, history })
      )
    }
    return { player: newPlayer }
  }),

  closePlayer: () => set(s => ({
    view: s.player.returnTo || 'library',
    player: { story: null, sceneId: null, history: [], shufflers: {}, returnTo: 'library', playTick: 0 },
  })),

  // Creator state
  creator: {
    story: null,
    selectedNodeId: null,
    positions: {},
  },

  setCreatorStory: (story) => {
    const positions = {}
    const scenes = Object.values(story.scenes)
    scenes.forEach((sc, i) => {
      positions[sc.id] = { x: 40 + (i % 4) * 215, y: 50 + Math.floor(i / 4) * 170 }
    })
    set({ creator: { story: JSON.parse(JSON.stringify(story)), selectedNodeId: null, positions } })
  },

  // Sync creator's story back to the stories array + persist
  saveCreatorStory: () => set(s => {
    if (!s.creator.story) return {}
    const edited = JSON.parse(JSON.stringify(s.creator.story))
    edited.updatedAt = Date.now()
    const stories = upsertStory(s.stories, edited)
    saveStories(stories)
    return { stories }
  }),

  selectNode: (id) => set(s => ({
    creator: { ...s.creator, selectedNodeId: id }
  })),

  updateScene: (sceneId, key, value) => set(s => {
    const story = { ...s.creator.story }
    story.scenes = { ...story.scenes }
    const updated = { ...story.scenes[sceneId], [key]: value }
    if (key === 'script') updated.scriptUpdatedAt = Date.now()
    story.scenes[sceneId] = updated
    // Auto-save to stories array + localStorage
    story.updatedAt = Date.now()
    const stories = upsertStory(s.stories, JSON.parse(JSON.stringify(story)))
    saveStories(stories)
    return { creator: { ...s.creator, story }, stories }
  }),

  updateNodePosition: (id, x, y) => set(s => ({
    creator: {
      ...s.creator,
      positions: { ...s.creator.positions, [id]: { x, y } }
    }
  })),

  addScene: () => set(s => {
    const story = JSON.parse(JSON.stringify(s.creator.story))
    const id = 'scene_' + Date.now()
    const d = story.defaults || {}
    story.scenes[id] = {
      id, title: 'New Scene', emotion: 'default', bgKey: 'a', bgImage: null,
      script: '', scriptUpdatedAt: null, audioGeneratedAt: null,
      clips: [],
      secondsBeforeEnd: d.secondsBeforeEnd ?? 5,
      defaultChoice: 0,
      countdown: d.countdown ?? 10,
      choices: []
    }
    const positions = { ...s.creator.positions }
    positions[id] = { x: 60, y: 60 }
    const stories = upsertStory(s.stories, JSON.parse(JSON.stringify(story)))
    saveStories(stories)
    return { creator: { ...s.creator, story, positions, selectedNodeId: id }, stories }
  }),

  // Chain a new scene off the given one: creates a scene, links it via a single
  // "Continue…" choice, and drops it below the parent in the graph. If the
  // parent was an end node (no choices), also restores sensible default-choice /
  // countdown / reveal timing so the auto-advance works.
  addSceneAfter: (fromId) => set(s => {
    const story = JSON.parse(JSON.stringify(s.creator.story))
    const from = story.scenes[fromId]
    if (!from) return s
    const newId = 'scene_' + Date.now()
    const d = story.defaults || {}
    story.scenes[newId] = {
      id: newId, title: 'New Scene', emotion: 'default', bgKey: 'a', bgImage: null,
      script: '', scriptUpdatedAt: null, audioGeneratedAt: null,
      clips: [],
      secondsBeforeEnd: d.secondsBeforeEnd ?? 5,
      defaultChoice: 0,
      countdown: d.countdown ?? 10,
      choices: []
    }
    if (from.choices.length === 0) {
      from.defaultChoice = 0
      if (!from.countdown) from.countdown = d.countdown ?? 10
      if (!from.secondsBeforeEnd) from.secondsBeforeEnd = d.secondsBeforeEnd ?? 5
    }
    from.choices.push({ text: 'Continue…', target: newId })

    const positions = { ...s.creator.positions }
    const fromPos = positions[fromId]
    const NH = 118
    positions[newId] = fromPos
      ? { x: fromPos.x, y: fromPos.y + NH + 60 }
      : { x: 60, y: 60 }

    story.updatedAt = Date.now()
    const stories = upsertStory(s.stories, JSON.parse(JSON.stringify(story)))
    saveStories(stories)
    return { creator: { ...s.creator, story, positions, selectedNodeId: newId }, stories }
  }),

  deleteScene: (id) => set(s => {
    const story = JSON.parse(JSON.stringify(s.creator.story))
    delete story.scenes[id]
    Object.values(story.scenes).forEach(sc => {
      sc.choices = sc.choices.filter(c => c.target !== id)
    })
    const positions = { ...s.creator.positions }
    delete positions[id]
    const stories = upsertStory(s.stories, JSON.parse(JSON.stringify(story)))
    saveStories(stories)
    return { creator: { ...s.creator, story, positions, selectedNodeId: null }, stories }
  }),

  setStartScene: (id) => set(s => {
    if (!s.creator.story) return {}
    const story = { ...s.creator.story, startScene: id, updatedAt: Date.now() }
    const stories = upsertStory(s.stories, JSON.parse(JSON.stringify(story)))
    saveStories(stories)
    return { creator: { ...s.creator, story }, stories }
  }),

  // Generic story-level updater (title, defaultBgImage, defaults, hidden, narrator, …)
  updateStoryField: (key, value) => set(s => {
    if (!s.creator.story) return {}
    const story = { ...s.creator.story, [key]: value, updatedAt: Date.now() }
    const stories = upsertStory(s.stories, JSON.parse(JSON.stringify(story)))
    saveStories(stories)
    return { creator: { ...s.creator, story }, stories }
  }),
  // Nested portrait updater for story.narrator.portraits[emotion]
  updateNarratorPortrait: (emotion, url) => set(s => {
    if (!s.creator.story) return {}
    const narrator = { ...s.creator.story.narrator }
    narrator.portraits = { ...(narrator.portraits || {}), [emotion]: url || null }
    const story = { ...s.creator.story, narrator, updatedAt: Date.now() }
    const stories = upsertStory(s.stories, JSON.parse(JSON.stringify(story)))
    saveStories(stories)
    return { creator: { ...s.creator, story }, stories }
  }),
  // Hydrate image fields on a story from fresh blob URLs (called on app boot
  // to restore images from IndexedDB so Library/Detail show covers without
  // having to enter the editor first). Only fills in MISSING fields — won't
  // overwrite a path the user explicitly set.
  //
  // patch shape:
  //   { coverImage?: blobUrl, defaultBgImage?: blobUrl, scenes?: { sceneId: blobUrl } }
  hydrateImagesForStory: (storyId, patch) => set(s => {
    const stories = s.stories.map(st => {
      if (st.id !== storyId) return st
      const next = { ...st }
      if (patch.coverImage && !next.coverImage) next.coverImage = patch.coverImage
      if (patch.defaultBgImage && !next.defaultBgImage) next.defaultBgImage = patch.defaultBgImage
      if (patch.scenes && next.scenes) {
        const newScenes = { ...next.scenes }
        let touched = false
        for (const [sceneId, blobUrl] of Object.entries(patch.scenes)) {
          const sc = newScenes[sceneId]
          if (sc && !sc.bgImage) {
            newScenes[sceneId] = { ...sc, bgImage: blobUrl }
            touched = true
          }
        }
        if (touched) next.scenes = newScenes
      }
      return next
    })
    // If the editor has this story open, sync it too
    let creator = s.creator
    if (s.creator.story?.id === storyId) {
      const updated = stories.find(x => x.id === storyId)
      if (updated) creator = { ...s.creator, story: updated }
    }
    // NOTE: we do NOT call saveStories here — blob URLs would be stripped and
    // we'd lose them on next boot. The persistence of these images is done
    // by IndexedDB + re-running this hydration on load.
    return { stories, creator }
  }),

  // Update any field on story.narrator (name, emoji, …)
  updateNarratorField: (key, value) => set(s => {
    if (!s.creator.story) return {}
    const narrator = { ...s.creator.story.narrator, [key]: value }
    const story = { ...s.creator.story, narrator, updatedAt: Date.now() }
    const stories = upsertStory(s.stories, JSON.parse(JSON.stringify(story)))
    saveStories(stories)
    return { creator: { ...s.creator, story }, stories }
  }),

  // Save / Load helpers
  getSave: (storyId) => {
    try { return JSON.parse(localStorage.getItem('murmur_' + storyId)) }
    catch { return null }
  },
  clearSave: (storyId) => localStorage.removeItem('murmur_' + storyId),
}))
