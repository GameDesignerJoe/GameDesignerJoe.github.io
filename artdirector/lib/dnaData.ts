import type { DNAOption, GameRef } from '@/types';

export const DNA_SPECTRUM: DNAOption[] = [
  {
    name: 'Cinematic Realism',
    v: 'photorealistic game art, physically-based rendering, cinematic realism, hyper-detailed surfaces and textures, film-quality lighting',
    desc: 'Everything looks like it could physically exist. PBR materials, realistic lighting. The camera could be a film camera.',
    tags: ['No outlines', 'High surface detail', 'Realistic anatomy', 'PBR materials'],
    cross: 'Works best with: Natural/Earthy or Dark/Moody palette. Dramatic or Soft lighting.',
    quadrantX: 90,
  },
  {
    name: 'Stylized Painterly',
    v: 'stylized painterly game art, expressive brushstroke quality throughout, concept-art aesthetic, artistic rendering, slightly pushed proportions and colors, painterly texture on all surfaces',
    desc: 'Painterly texture on every surface, expressively pushed proportions. Still 3D, but clearly made by hand.',
    tags: ['Soft or no outlines', 'Brushstroke surfaces', 'Heroic proportions', 'Painterly surfaces'],
    cross: 'Works best with: Bold/Vibrant or Natural palette. Dramatic or Golden lighting.',
    quadrantX: 70,
  },
  {
    name: 'Graphic / Cel-Shaded',
    v: 'cel-shaded graphic art style, bold ink outlines on every element, flat or semi-flat color fills, hard shadow boundaries, graphic novel aesthetic, toon rendering throughout',
    desc: 'Bold outlines on every element. Flat fills. High contrast. Feels like a comic book in motion.',
    tags: ['Bold outlines everywhere', 'Flat color fills', 'High contrast', 'Graphic enemies'],
    cross: 'Works best with: Bold/Vibrant or Neon palette. Dramatic or Soft lighting.',
    quadrantX: 50,
  },
  {
    name: 'Hand-Drawn / Illustrated',
    v: 'hand-drawn illustrated game art, expressive ink linework on all elements, organic watercolor and ink texture throughout, visible hand-crafted quality in every asset',
    desc: 'Everything looks drawn by hand. Linework varies in weight. Organic, beautifully imperfect.',
    tags: ['Variable linework', 'Ink/watercolor texture', 'Gestural characters', 'Drawn props'],
    cross: 'Works best with: Natural/Earthy or Muted palette. Soft or Golden lighting.',
    quadrantX: 30,
  },
  {
    name: 'Minimalist / Design-Forward',
    v: 'minimalist geometric game art, flat design throughout, shape-language driven with severely limited palette, silhouette-first design philosophy, design-forward aesthetic on every element',
    desc: 'Shape language carries all information. Severe palette. Silhouettes must work without detail.',
    tags: ['Silhouette-first', 'Geometric shapes', 'Minimal palette', 'Abstract props'],
    cross: 'Works best with: Muted or Neon palette. Soft or Dramatic lighting. Sparse detail.',
    quadrantX: 10,
  },
];

export const DNA_COHERENCE: Record<string, string> = {
  'Cinematic Realism':
    'DNA locked: Cinematic Realism. All assets use PBR rendering — no outlines, no stylization anywhere.',
  'Stylized Painterly':
    'DNA locked: Stylized Painterly. All assets share brushstroke quality and slightly pushed proportions.',
  'Graphic / Cel-Shaded':
    'DNA locked: Graphic / Cel-Shaded. Bold ink outlines appear on everything — not just some assets.',
  'Hand-Drawn / Illustrated':
    'DNA locked: Hand-Drawn / Illustrated. Ink-and-watercolor quality extends to every asset type.',
  'Minimalist / Design-Forward':
    'DNA locked: Minimalist / Design-Forward. Shape-first thinking and limited palette apply everywhere.',
};

export const GAMES_BY_DNA: Record<string, GameRef[]> = {
  'Cinematic Realism': [
    { n: 'Firewatch', q: 'Firewatch game art style', scope: 'indie' },
    { n: 'Soma', q: 'Soma game art style', scope: 'indie' },
    { n: 'What Remains of Edith Finch', q: 'What Remains of Edith Finch art style', scope: 'indie' },
    { n: 'Outer Wilds', q: 'Outer Wilds game art style', scope: 'indie' },
    { n: 'Oxenfree', q: 'Oxenfree game art style', scope: 'indie' },
    { n: 'Stray', q: 'Stray game art style', scope: 'mid' },
    { n: 'Kena: Bridge of Spirits', q: 'Kena Bridge of Spirits art style', scope: 'mid' },
    { n: 'A Plague Tale: Innocence', q: 'A Plague Tale Innocence art style', scope: 'mid' },
    { n: 'Hellblade', q: 'Hellblade Senua Sacrifice art style', scope: 'mid' },
    { n: 'The Last of Us II', q: 'The Last of Us Part 2 art style', scope: 'aaa' },
    { n: 'God of War (2018)', q: 'God of War 2018 art style', scope: 'aaa' },
    { n: 'Ghost of Tsushima', q: 'Ghost of Tsushima art style', scope: 'aaa' },
    { n: 'Red Dead Redemption 2', q: 'Red Dead Redemption 2 art style', scope: 'aaa' },
    { n: 'Returnal', q: 'Returnal game art style', scope: 'aaa' },
  ],
  'Stylized Painterly': [
    { n: 'Tunic', q: 'Tunic game art style', scope: 'indie' },
    { n: 'Spiritfarer', q: 'Spiritfarer game art style', scope: 'indie' },
    { n: 'Haven', q: 'Haven game art style', scope: 'indie' },
    { n: 'Wildermyth', q: 'Wildermyth game art style', scope: 'indie' },
    { n: 'Hi-Fi Rush', q: 'Hi-Fi Rush game art style', scope: 'mid' },
    { n: 'Psychonauts 2', q: 'Psychonauts 2 art style', scope: 'mid' },
    { n: 'Prey (2017)', q: 'Prey 2017 game art style', scope: 'mid' },
    { n: 'Control', q: 'Control Remedy art style', scope: 'mid' },
    { n: 'Dishonored 2', q: 'Dishonored 2 art style', scope: 'aaa' },
    { n: 'Bioshock Infinite', q: 'Bioshock Infinite art style', scope: 'aaa' },
    { n: 'Deathloop', q: 'Deathloop game art style', scope: 'aaa' },
  ],
  'Graphic / Cel-Shaded': [
    { n: 'Pyre', q: 'Pyre Supergiant game art style', scope: 'indie' },
    { n: 'Hades', q: 'Hades game art style', scope: 'indie' },
    { n: 'Hades II', q: 'Hades II art style', scope: 'indie' },
    { n: 'Skullgirls', q: 'Skullgirls game art style', scope: 'indie' },
    { n: 'Jet Set Radio', q: 'Jet Set Radio game art style', scope: 'indie' },
    { n: 'Knockout City', q: 'Knockout City game art style', scope: 'mid' },
    { n: 'Hi-Fi Rush cel', q: 'Hi-Fi Rush cel shaded art style', scope: 'mid' },
    { n: 'Guilty Gear Strive', q: 'Guilty Gear Strive art style', scope: 'aaa' },
    { n: 'Borderlands 3', q: 'Borderlands 3 cel shaded art style', scope: 'aaa' },
  ],
  'Hand-Drawn / Illustrated': [
    { n: 'Hollow Knight', q: 'Hollow Knight game art style', scope: 'indie' },
    { n: 'Cuphead', q: 'Cuphead game art style', scope: 'indie' },
    { n: 'Gris', q: 'Gris game art style', scope: 'indie' },
    { n: 'Dead Cells', q: 'Dead Cells game art style', scope: 'indie' },
    { n: 'Sable', q: 'Sable game art style', scope: 'indie' },
    { n: 'Cult of the Lamb', q: 'Cult of the Lamb game art style', scope: 'indie' },
    { n: 'Spiritfarer (2D)', q: 'Spiritfarer hand drawn art style', scope: 'indie' },
    { n: 'Ori: Blind Forest', q: 'Ori Blind Forest art style', scope: 'mid' },
    { n: 'Ori: Will of the Wisps', q: 'Ori Will of the Wisps art style', scope: 'mid' },
  ],
  'Minimalist / Design-Forward': [
    { n: 'Journey', q: 'Journey thatgamecompany art style', scope: 'indie' },
    { n: 'Gris', q: 'Gris game art style minimalist', scope: 'indie' },
    { n: 'Limbo', q: 'Limbo Playdead game art style', scope: 'indie' },
    { n: 'Inside', q: 'Inside Playdead game art style', scope: 'indie' },
    { n: 'Cocoon', q: 'Cocoon 2023 game art style', scope: 'indie' },
    { n: 'Flower', q: 'Flower thatgamecompany art style', scope: 'indie' },
    { n: 'Transistor', q: 'Transistor Supergiant art style', scope: 'indie' },
    { n: 'Monument Valley', q: 'Monument Valley game art style', scope: 'indie' },
    { n: 'Abzu', q: 'Abzu game art style', scope: 'mid' },
  ],
};

export const SCOPE_LABELS: Record<string, string> = {
  indie: 'Indie / Artful',
  mid: 'Mid-tier',
  aaa: 'AAA',
};
