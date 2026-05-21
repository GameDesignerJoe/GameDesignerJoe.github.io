import type { ImageRatio, WizardState } from '@/types';
import { isFP } from '@/store/wizardStore';
import type { StepId } from '@/components/wizard/steps';

export interface PreviewSpec {
  prompt: string;
  ratio: ImageRatio;
  /** Short human-readable description of what's being previewed, shown above the image. */
  label: string;
}

const NEG = 'no text, no watermark, no UI overlay';

function styleCore(s: WizardState): string {
  return [s.dna, s.colorMood, s.lighting, s.shapeLanguage, s.detailDensity]
    .filter(Boolean)
    .join(', ');
}

export function buildPreviewPrompt(stepId: StepId, s: WizardState): PreviewSpec | null {
  switch (stepId) {
    case 'dna': {
      if (!s.dna) return null;
      const color = s.colorMood || 'rich color palette';
      return {
        label: `Atmospheric environment in ${s.dnaName}`,
        ratio: 'landscape_16_9',
        prompt: `${s.dna}, atmospheric game environment, moody lighting, no characters, establishing wide shot, professional game concept art, ${color}, ${NEG}`,
      };
    }

    case 'rules': {
      if (!s.dna) return null;
      const parts = [s.shapeLanguage, s.colorMood, s.lighting, s.detailDensity].filter(Boolean);
      if (!parts.length) return null;
      return {
        label: 'Material / surface study in your style',
        ratio: 'square_hd',
        prompt: `${s.dna} game art material and surface study, ${parts.join(', ')}, abstract material texture detail, close-up surface, no characters, no objects in frame, professional game concept art, ${NEG}`,
      };
    }

    case 'environments': {
      const desc = s.envDesc1 || s.setting;
      if (!desc) return null;
      const arch = s.archStyle ? ', ' + s.archStyle : '';
      const core = styleCore(s) || 'game concept art';
      return {
        label: 'Primary environment',
        ratio: 'landscape_16_9',
        prompt: `${s.genre || 'game'} environment concept art, ${desc}${arch}, wide establishing shot, no characters in frame, ${core}, ${s.tone || 'atmospheric'}, environmental storytelling, ${NEG}`,
      };
    }

    case 'characters': {
      const core = styleCore(s) || 'game concept art';
      if (isFP(s)) {
        if (!s.handsDesc) return null;
        return {
          label: 'First-person hands study',
          ratio: 'square_hd',
          prompt: `${s.genre || 'game'} first-person hands study, ${s.handsDesc}, centered figure study, ${core}, ${s.tone || 'atmospheric'}, clean neutral background, ${NEG}`,
        };
      }
      const desc = s.charDesc || [s.bodyProp, s.costumeComp].filter(Boolean).join(', ');
      if (!desc) return null;
      return {
        label: 'Character portrait',
        ratio: 'portrait_4_3',
        prompt: `${s.genre || 'game'} character portrait, ${desc}, face and upper body, ${core}, ${s.tone || 'atmospheric'}, expressive readable personality, ${NEG}`,
      };
    }

    case 'enemies': {
      if (!s.enemyNature || s.enemyNature.includes('no enemies')) return null;
      const desc = s.enemyDesc || s.enemyNature;
      const core = styleCore(s) || s.dna || 'game concept art';
      return {
        label: 'Enemy study',
        ratio: 'square_hd',
        prompt: `${s.genre || 'game'} enemy concept art, ${desc}, isolated figure study, ${core}, ${s.tone || 'atmospheric'} threat aesthetic, front view, game enemy design sheet, ${NEG}`,
      };
    }

    case 'props': {
      if (!s.singleProp) return null;
      const core = styleCore(s) || s.dna || 'game concept art';
      const setting = s.setting || 'game world';
      return {
        label: 'Prop study',
        ratio: 'square_hd',
        prompt: `${s.genre || 'game'} prop concept art, ${s.singleProp}, isolated on dark neutral background, ${core}, front view and three-quarter view, material texture study, consistent with ${setting}, ${NEG}`,
      };
    }

    // Steps without previews: identity, tone, quadrant (its own visual), references, titleui
    default:
      return null;
  }
}
