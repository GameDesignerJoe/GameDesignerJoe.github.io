import type { OptionCard } from '@/types';

export const GENRES: OptionCard[] = [
  { v: 'action extraction shooter', icon: '🎯', title: 'Action / Extraction', desc: 'Combat-forward, mission loop' },
  { v: 'action RPG', icon: '⚔️', title: 'Action RPG', desc: 'Combat + progression' },
  { v: 'horror survival', icon: '👁️', title: 'Horror / Survival', desc: 'Dread, resource scarcity' },
  { v: 'strategy and tactics', icon: '♞', title: 'Strategy / Tactics', desc: 'Planning, positioning' },
  { v: 'narrative adventure', icon: '📚', title: 'Narrative', desc: 'Story and character driven' },
  { v: 'roguelike run-based', icon: '🔄', title: 'Roguelike', desc: 'Runs, builds, permadeath' },
  { v: 'platformer with exploration', icon: '🏃', title: 'Platformer', desc: 'Movement, traversal' },
  { v: 'open world exploration', icon: '🗺️', title: 'Open World', desc: 'Exploration first' },
];

export const PLATFORMS: OptionCard[] = [
  { v: 'PC and console', icon: '🖥️', title: 'PC / Console' },
  { v: 'Nintendo Switch', icon: '🕹️', title: 'Switch' },
  { v: 'mobile', icon: '📱', title: 'Mobile' },
  { v: 'VR', icon: '🥽', title: 'VR' },
];

export const CAMERAS: OptionCard[] = [
  {
    v: "first-person perspective, camera is the player's eyes, no player character visible from outside",
    icon: '👁️',
    title: 'First Person',
    desc: 'FPS / adventure. Hands and arms only — no full character shown',
  },
  {
    v: 'third-person over-the-shoulder camera, character visible from behind and sides',
    icon: '🎮',
    title: 'Third Person',
    desc: 'TPS / over-shoulder. Character fully visible',
  },
  {
    v: 'isometric angled top-down camera, classic isometric projection',
    icon: '◈',
    title: 'Isometric',
    desc: 'Angled overhead, classic RPG view',
  },
  {
    v: 'top-down directly overhead camera view',
    icon: '⬬',
    title: 'Top-Down',
    desc: "Bird's-eye, directly above",
  },
  {
    v: 'side-scrolling 2D perspective camera',
    icon: '▶',
    title: 'Side-Scrolling',
    desc: '2D side view, platformer style',
  },
  {
    v: 'fixed cinematic camera angles set by the designer',
    icon: '🎥',
    title: 'Fixed / Cinematic',
    desc: 'Set angles, cinematic framing',
  },
];

export const DIMENSIONS: OptionCard[] = [
  {
    v: 'pure 2D game art, sprites and drawn assets, flat layered composition',
    icon: '▭',
    title: 'Pure 2D',
    desc: 'Sprites, drawn, layered',
  },
  {
    v: '2.5D game, 3D environment with constrained perspective, depth through layers',
    icon: '◳',
    title: '2.5D',
    desc: '3D world, constrained camera',
  },
  {
    v: '3D world with stylized 2D-influenced art direction, toon or flat shading on 3D models',
    icon: '◑',
    title: '3D + 2D Art Direction',
    desc: '3D models, toon/flat rendering',
  },
  {
    v: 'fully 3D game with open camera, volumetric depth, three-dimensional space',
    icon: '⬬',
    title: 'Full 3D',
    desc: 'Open camera, full depth',
  },
];

export const SCOPES: OptionCard[] = [
  {
    v: 'artfully constrained indie production, small team, every asset earns its place, elegant simplicity over volume',
    icon: '🌱',
    title: 'Indie / Artful',
    desc: 'Small team, every element intentional',
  },
  {
    v: 'focused mid-tier production quality, professional polish within defined scope, dedicated art team',
    icon: '🔧',
    title: 'Mid-tier / Focused',
    desc: 'Dedicated team, polished scope',
  },
  {
    v: 'AAA full production quality, technically ambitious, hyper-detailed, large studio scope',
    icon: '🏆',
    title: 'AAA / Full',
    desc: 'Large studio, maximum density',
  },
];

export const TONES: OptionCard[] = [
  { v: 'dark gritty brutal and oppressive, heavy with consequence and weight', icon: '🌑', title: 'Dark / Gritty', desc: 'Heavy, brutal, real stakes' },
  { v: 'hopeful and bright, uplifting, triumph over adversity', icon: '☀️', title: 'Hopeful / Bright', desc: 'Optimistic, energizing' },
  { v: 'eerie mysterious unsettling, something wrong beneath the surface, liminal and strange', icon: '🌒', title: 'Eerie / Mysterious', desc: 'Strange, liminal, unknown' },
  { v: 'epic and grand, mythological scale, heroic stakes, monumental', icon: '🍷', title: 'Epic / Grand', desc: 'Myth-scale, monumental' },
  { v: 'tense and urgent, constant pressure, reactive, high stakes moment-to-moment', icon: '⚡', title: 'Tense / Urgent', desc: 'Pressure, pulse-pounding' },
  { v: 'stylish confident dripping with attitude and swagger', icon: '✨', title: 'Stylish / Cool', desc: 'Swagger, flair, attitude' },
];

export const WORLD_FEELS: OptionCard[] = [
  { v: 'threatening and hostile, danger everywhere, survival is the goal', icon: '☠️', title: 'Hostile', desc: 'Dangerous, survivalist' },
  { v: 'morally complex, beauty and danger coexist, worth understanding', icon: '⚖️', title: 'Complex', desc: 'Layered, morally grey' },
  { v: 'wondrous and worth exploring, rewards curiosity, alive with possibility', icon: '🔭', title: 'Wondrous', desc: 'Inviting, full of life' },
];

export const PACINGS: OptionCard[] = [
  { v: 'fast kinetic always moving, action drives every moment', icon: '💨', title: 'Fast / Kinetic' },
  { v: 'measured and deliberate, tactical thoughtful pacing', icon: '🛡️', title: 'Deliberate' },
  { v: 'slow atmospheric and contemplative, mood over momentum', icon: '🌊', title: 'Atmospheric' },
];

export const SHAPE_LANGUAGES: OptionCard[] = [
  { v: 'angular sharp geometric shapes throughout, aggressive hard-edged mechanical feeling', icon: '◇', title: 'Angular / Sharp', desc: 'Aggressive, industrial, sci-fi' },
  { v: 'intentional shape contrast, sharp threatening enemy shapes against rounded approachable hero shapes', icon: '◘', title: 'Mixed / Contrast', desc: 'Sharp threats, soft allies' },
  { v: 'rounded organic soft shapes throughout, natural flowing approachable feeling', icon: '○', title: 'Rounded / Organic', desc: 'Natural, approachable' },
];

export const COLOR_MOODS: OptionCard[] = [
  { v: 'rich vibrant saturated colors, bold punchy hues, eye-catching palette throughout', icon: '🎨', title: 'Bold / Vibrant', desc: 'Punchy, saturated' },
  { v: 'natural earthy tones throughout, warm organic palette, grounded believable colors', icon: '🌒', title: 'Natural / Earthy', desc: 'Browns, greens, believable' },
  { v: 'dark moody desaturated palette throughout, deep atmospheric shadows, grim weighted tones', icon: '🌫️', title: 'Dark / Moody', desc: 'Desaturated, heavy' },
  { v: 'neon electric accent colors over dark base, glowing highlights, high-contrast cyberpunk palette', icon: '⚡', title: 'Neon / Electric', desc: 'Glow, contrast, cyber' },
  { v: 'muted subtle desaturated palette, understated elegant tones, restrained and quiet color', icon: '🪶', title: 'Muted / Subtle', desc: 'Low saturation, elegant' },
];

export const LIGHTINGS: OptionCard[] = [
  { v: 'warm golden-hour lighting, long dramatic shadows, amber atmospheric glow', icon: '🌅', title: 'Golden / Warm', desc: 'Amber, sunset, long shadows' },
  { v: 'cool moonlit atmosphere, blue-grey tones, silver cold light', icon: '🌙', title: 'Cool / Night', desc: 'Blue, lunar, cold' },
  { v: 'dramatic chiaroscuro lighting, deep shadows against bright highlights, high contrast volume', icon: '🎭', title: 'Dramatic', desc: 'Deep shadows, contrast' },
  { v: 'soft diffused ambient lighting, even exposure, gentle shadows, overcast quality', icon: '🌥️', title: 'Soft / Ambient', desc: 'Even, diffused, gentle' },
  { v: 'harsh direct intense lighting, sharp cast shadows, unforgiving exposure', icon: '☀️', title: 'Harsh / Intense', desc: 'Glaring, unforgiving' },
];

export const DETAIL_DENSITIES: OptionCard[] = [
  { v: 'sparse and readable with deliberate negative space, clean focused compositions', title: 'Sparse / Clean', desc: 'Breathable, deliberate' },
  { v: 'balanced detail level, rich enough to feel substantial without overwhelming', title: 'Balanced', desc: 'Rich but readable' },
  { v: 'dense richly layered detail, rewards close inspection, complex visual environment', title: 'Dense / Rich', desc: 'Layered, intricate' },
];

export const SETTINGS: OptionCard[] = [
  { v: 'sci-fi futuristic universe', icon: '🚀', title: 'Sci-fi / Future' },
  { v: 'epic fantasy realm', icon: '🧙', title: 'Fantasy' },
  { v: 'post-apocalyptic collapsed civilization', icon: '🏚️', title: 'Post-Apocalyptic' },
  { v: 'contemporary modern world', icon: '🏙️', title: 'Contemporary' },
  { v: 'historical inspired period setting', icon: '🏰', title: 'Historical' },
  { v: 'alien or cosmic world with unknown rules', icon: '👽', title: 'Alien / Cosmic' },
];

export const BODY_PROPS: OptionCard[] = [
  { v: 'realistic human anatomy and proportions', icon: '🧍', title: 'Realistic' },
  { v: 'slightly stylized heroic proportions pushed for readability', icon: '🦸', title: 'Heroic / Stylized' },
  { v: 'strongly exaggerated proportions, anime or cartoon-influenced', icon: '✨', title: 'Exaggerated' },
];

export const COSTUME_COMPS: OptionCard[] = [
  { v: 'simple functional outfit, clean readable silhouette, minimal ornamentation', icon: '👕', title: 'Simple / Functional' },
  { v: 'detailed layered equipment with moderate ornamentation, worn textures with history', icon: '🥽', title: 'Detailed / Layered' },
  { v: 'ornate elaborate costume with intricate patterns and rich decoration', icon: '👑', title: 'Ornate / Elaborate' },
];

export const ENEMY_NATURES: OptionCard[] = [
  { v: 'no enemies, peaceful game with no combat opponents', icon: '🙊', title: 'No enemies', desc: 'Peaceful, no combat' },
  { v: 'humanoid soldier enemies, human or near-human opponents with tactical gear', icon: '👮', title: 'Humanoid / Soldiers', desc: 'Organized, tactical' },
  { v: 'creature and beast enemies, organic biological threats with natural weapons', icon: '🦖', title: 'Creatures / Beasts', desc: 'Feral, organic' },
  { v: 'robotic and mechanical enemies, machine threats with synthetic construction', icon: '🤖', title: 'Robotic / Machines', desc: 'Metal, mechanical' },
  { v: 'corrupted hybrid enemies, once something else now twisted and fused in wrong ways', icon: '☣️', title: 'Corrupted / Hybrid', desc: 'Twisted, fused, wrong' },
  { v: 'alien or cosmic entities, incomprehensible forms, otherworldly biology', icon: '👾', title: 'Alien / Cosmic', desc: 'Unknown, strange' },
];

export const EQUIP_AESTHETICS: OptionCard[] = [
  { v: 'military tactical equipment, functional over form, matte finishes, standardized components', icon: '🪖', title: 'Military / Tactical', desc: 'Functional, matte, standardized' },
  { v: 'advanced sci-fi technology, smooth integrated surfaces, clean industrial design', icon: '🔬', title: 'Sci-fi / Advanced', desc: 'Sleek, integrated, future' },
  { v: 'fantasy mystical equipment, ornate decorative surfaces, magical materials, runes and carvings', icon: '🔮', title: 'Mystical / Ornate', desc: 'Decorated, runic, magical' },
  { v: 'improvised salvaged equipment, mixed found materials, jury-rigged modifications, visible repairs', icon: '⚙️', title: 'Improvised / Salvaged', desc: 'Jury-rigged, patched, raw' },
  { v: 'modern contemporary everyday objects and equipment, familiar real-world items and materials', icon: '🏪', title: 'Modern / Contemporary', desc: 'Real-world, recognizable' },
  { v: 'alien organic equipment, grown rather than manufactured, biological materials, unfamiliar forms', icon: '🧝', title: 'Alien / Organic', desc: 'Grown, biological, strange' },
  { v: 'no weapons or combat equipment, peaceful world with tools and everyday objects only', icon: '🙊', title: 'No weapons', desc: 'Tools and objects only' },
];

export const FONT_STYLES: OptionCard[] = [
  { v: 'clean modern sans-serif typography, geometric letterforms, minimal ornamentation', title: 'Clean / Modern', desc: 'Geometric, minimal' },
  { v: 'elegant serif typography, refined letterforms, classical weight and proportion', title: 'Serif / Elegant', desc: 'Classical, refined' },
  { v: 'dramatic display typography, custom decorative letterforms, strong graphic presence', title: 'Display / Decorative', desc: 'Custom, graphic, bold' },
  { v: 'hand-lettered organic typography, drawn letterforms, natural imperfection and character', title: 'Hand-Lettered', desc: 'Drawn, organic' },
  { v: 'aggressive distressed typography, rough edges, battle-worn weight and texture', title: 'Aggressive / Distressed', desc: 'Rough, worn, battle-ready' },
  { v: 'technical monospaced typography, digital precision, code or data aesthetic', title: 'Technical / Mono', desc: 'Digital, precise, data' },
];

export const UI_STYLES: OptionCard[] = [
  { v: 'minimal diegetic UI, information lives in the world itself, no traditional HUD elements on screen', title: 'Minimal / Diegetic', desc: 'Info in world, no screen UI' },
  { v: 'clean subtle UI, small unobtrusive HUD elements, information available but never dominant', title: 'Clean / Subtle', desc: 'Small, readable, unobtrusive' },
  { v: 'tactical data-rich HUD, detailed information display, multiple readouts and indicators visible', title: 'Tactical / Data-rich', desc: 'Detailed HUD, lots of info' },
  { v: 'thematic UI that feels like an object from the game world, UI elements are artifacts of the setting', title: 'Thematic / World-built', desc: 'UI as world artifact' },
  { v: 'stylized UI with strong graphic identity and bold visual personality', title: 'Stylized / Graphic', desc: 'Bold UI personality' },
];

