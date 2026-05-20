import { NextResponse } from 'next/server';
import { generateImage } from '@/lib/imageGen';
import type { ImageQuality, ImageRatio } from '@/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface GenerateBody {
  prompt?: string;
  ratio?: ImageRatio;
  quality?: ImageQuality;
}

export async function POST(req: Request) {
  let body: GenerateBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { prompt, ratio = 'landscape_16_9', quality = 'fast' } = body;
  if (!prompt || typeof prompt !== 'string') {
    return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
  }

  try {
    const imageUrl = await generateImage(prompt, ratio, quality);
    return NextResponse.json({ imageUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Image generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
