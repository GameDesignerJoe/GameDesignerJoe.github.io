import { create } from 'zustand'
import { SmartShuffle } from '../engine/SmartShuffle'

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

  // Stories
  stories: DEMO_STORIES,
  addStory: (story) => set(s => ({ stories: [...s.stories, story] })),

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
  },

  launchStory: (story, sceneId, history = []) => {
    const shufflers = {}
    Object.values(story.scenes).forEach(sc => {
      shufflers[sc.id] = new SmartShuffle(sc.clips)
    })
    set({
      view: 'player',
      player: { story, sceneId, history: [...history], shufflers },
    })
  },

  goToScene: (sceneId) => set(s => {
    const history = [...s.player.history]
    if (!history.includes(sceneId)) history.push(sceneId)
    const newPlayer = { ...s.player, sceneId, history }
    // Save to localStorage
    if (s.player.story) {
      localStorage.setItem(
        'murmur_' + s.player.story.id,
        JSON.stringify({ sceneId, history })
      )
    }
    return { player: newPlayer }
  }),

  closePlayer: () => set({ view: 'library', player: { story: null, sceneId: null, history: [], shufflers: {} } }),

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

  selectNode: (id) => set(s => ({
    creator: { ...s.creator, selectedNodeId: id }
  })),

  updateScene: (sceneId, key, value) => set(s => {
    const story = { ...s.creator.story }
    story.scenes = { ...story.scenes }
    const updated = { ...story.scenes[sceneId], [key]: value }
    if (key === 'script') updated.scriptUpdatedAt = Date.now()
    story.scenes[sceneId] = updated
    return { creator: { ...s.creator, story } }
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
    story.scenes[id] = {
      id, title: 'New Scene', emotion: 'curious', bgKey: 'a', bgImage: null,
      script: '', scriptUpdatedAt: null, audioGeneratedAt: null,
      clips: [], secondsBeforeEnd: 5, defaultChoice: 0, countdown: 10, choices: []
    }
    const positions = { ...s.creator.positions }
    positions[id] = { x: 60, y: 60 }
    return { creator: { ...s.creator, story, positions, selectedNodeId: id } }
  }),

  deleteScene: (id) => set(s => {
    const story = JSON.parse(JSON.stringify(s.creator.story))
    delete story.scenes[id]
    Object.values(story.scenes).forEach(sc => {
      sc.choices = sc.choices.filter(c => c.target !== id)
    })
    const positions = { ...s.creator.positions }
    delete positions[id]
    return { creator: { ...s.creator, story, positions, selectedNodeId: null } }
  }),

  setStartScene: (id) => set(s => {
    const story = { ...s.creator.story, startScene: id }
    return { creator: { ...s.creator, story } }
  }),

  // Save / Load helpers
  getSave: (storyId) => {
    try { return JSON.parse(localStorage.getItem('murmur_' + storyId)) }
    catch { return null }
  },
  clearSave: (storyId) => localStorage.removeItem('murmur_' + storyId),
}))
