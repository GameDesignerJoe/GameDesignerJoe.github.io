import type { ImageRatio, PromptCardData, WizardState } from '@/types';
import { getScopeKey, isFP, noEnemies, noWeapons } from '@/store/wizardStore';

function searchUrl(q: string): string {
  return 'https://www.google.com/search?q=' + encodeURIComponent(q) + '&tbm=isch';
}

export function buildPrompts(st: WizardState): PromptCardData[] {
  const fp = isFP(st);
  const noE = noEnemies(st);
  const noW = noWeapons(st);

  const dna = st.dna || 'stylized game art';
  const color = st.colorMood || 'rich color palette';
  const light = st.lighting || 'cinematic lighting';
  const shapes = st.shapeLanguage || '';
  const detail = st.detailDensity || '';
  const dim = st.dimension || '';
  const refs = st.referenceGames.slice(0, 3);
  const refStr = refs.length ? 'visual references: ' + refs.join(', ') : '';
  const nonGame = st.nonGame ? 'inspired by ' + st.nonGame : '';
  const antiRef = st.antiRef ? 'avoid aesthetic of ' + st.antiRef : '';

  const scopeKey = getScopeKey(st);
  const scopeStr =
    scopeKey === 'indie'
      ? 'artfully constrained indie production, every element intentional'
      : scopeKey === 'mid'
      ? 'focused professional production quality'
      : scopeKey === 'aaa'
      ? 'AAA production quality, technically ambitious'
      : '';

  const tone = st.tone || 'atmospheric';
  const worldFeel = st.worldFeel || '';
  const genre = st.genre || 'video game';
  const title = st.gameTitle ? '"' + st.gameTitle + '" ' : '';
  const cam = st.cameraType || '';

  const setting = st.setting || 'game world';
  const arch = st.archStyle ? ', ' + st.archStyle : '';

  const charDesc = st.charDesc || (st.bodyProp || 'stylized') + ' protagonist in ' + (st.costumeComp || 'gear');
  const handsDesc = st.handsDesc || 'player hands holding equipment';
  const enemyDesc = st.enemyDesc || st.enemyNature || 'opponent';
  const prop = st.singleProp || 'signature world object';

  const styleCore = [dna, dim, color, light, shapes, detail, scopeStr, refStr, nonGame]
    .filter(Boolean)
    .join(', ');
  const neg = 'no watermark, no UI overlay, no HUD, no logo, no text';
  const refQ = (refs[0] || st.gameTitle || genre) + ' game art';
  const env1 = st.envDesc1 || setting;
  const env2 = st.envDesc2;
  const env3 = st.envDesc3;

  const cards: PromptCardData[] = [];
  let n = 1;

  // 1. Key art
  const keyPrompt = fp
    ? `${title}${genre} game key art, first-person perspective looking into ${env1}${arch}, ${styleCore}, ${tone}, ${worldFeel}, dramatic environmental composition, sense of world scale and stakes, ${antiRef}, ${neg}`
    : `${title}${genre} game key art, ${charDesc}, powerful iconic hero pose, ${env1}${arch} in background, ${styleCore}, ${tone}, ${worldFeel}, dramatic cinematic composition, game marketing art style, ${antiRef}, ${neg}`;
  cards.push({
    id: 'keyArt',
    num: n++,
    icon: '★',
    name: 'Key art',
    description: 'Primary marketing / pitch hero image',
    prompt: keyPrompt,
    badge: fp ? '16:9 landscape' : '4:3 portrait',
    ratio: fp ? '16:9' : '4:3',
    ratioKey: fp ? 'landscape_16_9' : 'portrait_4_3',
    refUrl: searchUrl(refQ + ' key art'),
  });

  // 2. Env 1
  cards.push({
    id: 'env1',
    num: n++,
    icon: '⬛',
    name: 'Primary environment',
    description: 'Signature location — most time spent here',
    prompt: `${genre} game environment concept art, ${env1}${arch}, wide establishing shot, 16:9, no characters in frame, ${styleCore}, ${tone}, ${worldFeel}, environmental storytelling, atmospheric depth and scale, ${antiRef}, ${neg}`,
    badge: '16:9 landscape',
    ratio: '16:9',
    ratioKey: 'landscape_16_9',
    refUrl: searchUrl(refQ + ' environment concept art'),
  });

  // 3. Env 2 (optional)
  if (env2 && env2.trim()) {
    cards.push({
      id: 'env2',
      num: n++,
      icon: '⬛',
      name: 'Secondary environment',
      description: 'A distinctly different area',
      prompt: `${genre} game environment concept art, ${env2}${arch}, wide establishing shot, 16:9, no characters in frame, ${styleCore}, ${tone}, environmental storytelling, ${antiRef}, ${neg}`,
      badge: '16:9 landscape',
      ratio: '16:9',
      ratioKey: 'landscape_16_9',
      refUrl: searchUrl(refQ + ' environment concept art'),
    });
  }

  // 4. Env 3 (optional)
  if (env3 && env3.trim()) {
    cards.push({
      id: 'env3',
      num: n++,
      icon: '⬛',
      name: 'Third environment',
      description: 'Maximum contrast space',
      prompt: `${genre} game environment concept art, ${env3}${arch}, wide establishing shot, 16:9, no characters in frame, ${styleCore}, ${tone}, environmental storytelling, ${antiRef}, ${neg}`,
      badge: '16:9 landscape',
      ratio: '16:9',
      ratioKey: 'landscape_16_9',
      refUrl: searchUrl(refQ + ' environment concept art'),
    });
  }

  // 5. Character or hands study
  if (fp) {
    cards.push({
      id: 'handsStudy',
      num: n++,
      icon: '○',
      name: 'First-person hands study',
      description: 'What the player sees of themselves',
      prompt: `${genre} game first-person hands study, ${handsDesc}, ${noW ? 'holding no weapon' : 'holding equipment'}, centered figure study, ${styleCore}, ${tone}, clean neutral background, front view and slight angle shown, ${antiRef}, ${neg}`,
      badge: 'Square',
      ratio: '1:1',
      ratioKey: 'square_hd',
      refUrl: searchUrl(genre + ' first person hands concept art'),
    });
  } else {
    cards.push({
      id: 'character',
      num: n++,
      icon: '○',
      name: 'Character portrait',
      description: 'Face and bust, expressive',
      prompt: `${genre} game character portrait, ${charDesc}, face and upper body, expressive ${tone.split(',')[0]} emotion, readable personality, ${styleCore}, character reveal art quality, ${antiRef}, ${neg}`,
      badge: 'Portrait',
      ratio: '2:3',
      ratioKey: 'portrait_4_3',
      refUrl: searchUrl(refQ + ' character portrait'),
    });
  }

  // 6. Enemy (conditional)
  if (!noE) {
    cards.push({
      id: 'enemyStudy',
      num: n++,
      icon: '☠',
      name: 'Enemy study',
      description: 'Example enemy design, front view',
      prompt: `${genre} game enemy concept art, ${enemyDesc}, isolated figure study, ${dna}, ${color}, ${shapes}, ${refStr}, ${tone} threat aesthetic, front view and three-quarter view, game enemy design sheet, ${antiRef}, ${neg}`,
      badge: 'Square',
      ratio: '1:1',
      ratioKey: 'square_hd',
      refUrl: searchUrl(genre + ' game enemy design concept art'),
    });
  }

  // 7. Prop study
  cards.push({
    id: 'propStudy',
    num: n++,
    icon: '□',
    name: 'Prop study',
    description: 'Key world object',
    prompt: `${genre} game prop concept art, ${prop}, isolated on dark neutral background, ${dna}, ${color}, front view and three-quarter view, material texture study, consistent with ${setting}${arch}, ${antiRef}, ${neg}`,
    badge: 'Square',
    ratio: '1:1',
    ratioKey: 'square_hd',
    refUrl: searchUrl(genre + ' game prop design concept art'),
  });

  // 8. Action beat
  const actionPrompt = fp
    ? `${genre} game action scene, first-person perspective, ${noW ? 'player hands reaching out' : handsDesc + ' visible in foreground'}, ${noE ? env1 : enemyDesc.split(',')[0] + ' visible ahead'} in ${env1}${arch}, ${styleCore}, ${tone}, kinetic energy, dramatic first-person framing, ${antiRef}, ${neg}`
    : `${genre} game cinematic action scene, ${charDesc}${noE ? ' exploring ' : ' in encounter with ' + enemyDesc.split(',')[0] + ' in '}${env1}${arch}, ${styleCore}, ${tone}, ${worldFeel}, kinetic energy, 16:9, dramatic camera angle, ${antiRef}, ${neg}`;
  cards.push({
    id: 'actionBeat',
    num: n++,
    icon: '▶',
    name: 'Action beat',
    description: 'Player in world — key gameplay moment',
    prompt: actionPrompt,
    badge: '16:9 landscape',
    ratio: '16:9',
    ratioKey: 'landscape_16_9',
    refUrl: searchUrl(refQ + ' gameplay screenshot'),
  });

  // 9. Title / Logo
  const titleName = st.gameTitle || 'Game Title';
  const logoStyle = st.fontStyle || 'strong display typography';
  cards.push({
    id: 'titleLogo',
    num: n++,
    icon: '★',
    name: 'Title & logo treatment',
    description: 'Header bar for pitch deck',
    prompt: `Game title logo and typography design for "${titleName}", ${genre} game, ${logoStyle}, ${dna} aesthetic applied to letterforms, ${tone} mood, ${color} color scheme, horizontal banner layout for pitch deck, ${shapes || 'strong graphic shapes'}, dark background, no tagline, graphic design concept, high quality, ${neg}`,
    badge: '4:1 wide banner',
    ratio: '4:1',
    ratioKey: 'landscape_16_9',
    refUrl: searchUrl(genre + ' game logo title treatment'),
  });

  // 10. UI
  const uiStyle = st.uiStyle || 'clean game UI design';
  const uiNotes = st.uiDesc ? ', ' + st.uiDesc : '';
  cards.push({
    id: 'uiMockup',
    num: n++,
    icon: '◇',
    name: 'UI / HUD mockup',
    description: 'Game interface concept',
    prompt: `${genre} game UI and HUD design mockup, ${cam || 'game'} perspective, ${uiStyle}${uiNotes}, ${dna} aesthetic applied to interface, ${color}, ${scopeStr}, showing relevant HUD elements for ${genre} gameplay, 16:9, no placeholder text, ${antiRef}, ${neg}`,
    badge: '16:9 landscape',
    ratio: '16:9',
    ratioKey: 'landscape_16_9',
    refUrl: searchUrl(genre + ' game UI HUD design concept'),
  });

  return cards;
}

export const RATIO_MAP: Record<string, ImageRatio> = {
  keyArt: 'portrait_4_3',
  env1: 'landscape_16_9',
  env2: 'landscape_16_9',
  env3: 'landscape_16_9',
  character: 'portrait_4_3',
  handsStudy: 'square_hd',
  enemyStudy: 'square_hd',
  propStudy: 'square_hd',
  actionBeat: 'landscape_16_9',
  titleLogo: 'landscape_16_9',
  uiMockup: 'landscape_16_9',
};
