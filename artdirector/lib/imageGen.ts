import { fal } from '@fal-ai/client';
import type { ImageQuality, ImageRatio } from '@/types';

let configured = false;
function ensureConfigured() {
  if (configured) return;
  const key = process.env.FAL_KEY;
  if (!key) throw new Error('FAL_KEY is not set');
  fal.config({ credentials: key });
  configured = true;
}

export async function generateImage(
  prompt: string,
  ratio: ImageRatio = 'landscape_16_9',
  quality: ImageQuality = 'fast'
): Promise<string> {
  ensureConfigured();
  const model = quality === 'fast' ? 'fal-ai/flux/schnell' : 'fal-ai/flux/dev';

  const result = await fal.subscribe(model, {
    input: {
      prompt,
      image_size: ratio,
      num_inference_steps: quality === 'fast' ? 4 : 28,
    },
  });

  const data = result.data as { images?: Array<{ url: string }> };
  const url = data.images?.[0]?.url;
  if (!url) throw new Error('fal.ai returned no image');
  return url;
}
