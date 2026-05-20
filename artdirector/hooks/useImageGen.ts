'use client';

import { useCallback, useState } from 'react';
import { getCachedImage, setCachedImage } from '@/lib/imageCache';
import type { ImageQuality, ImageRatio } from '@/types';

interface GenerateArgs {
  prompt: string;
  ratio: ImageRatio;
  quality?: ImageQuality;
}

interface State {
  imageUrl: string | null;
  isLoading: boolean;
  error: string | null;
}

const INITIAL: State = { imageUrl: null, isLoading: false, error: null };

export function useImageGen() {
  const [state, setState] = useState<State>(INITIAL);

  const generate = useCallback(async ({ prompt, ratio, quality = 'fast' }: GenerateArgs) => {
    const cached = getCachedImage(ratio, prompt);
    if (cached) {
      setState({ imageUrl: cached, isLoading: false, error: null });
      return cached;
    }

    setState((s) => ({ imageUrl: s.imageUrl, isLoading: true, error: null }));
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, ratio, quality }),
      });
      const data: { imageUrl?: string; error?: string } = await res.json();
      if (!res.ok || !data.imageUrl) {
        const error = data.error || `Image generation failed (${res.status})`;
        setState({ imageUrl: null, isLoading: false, error });
        return null;
      }
      setCachedImage(ratio, prompt, data.imageUrl);
      setState({ imageUrl: data.imageUrl, isLoading: false, error: null });
      return data.imageUrl;
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Network error';
      setState({ imageUrl: null, isLoading: false, error });
      return null;
    }
  }, []);

  const showCached = useCallback((ratio: ImageRatio, prompt: string) => {
    const cached = getCachedImage(ratio, prompt);
    setState(cached ? { imageUrl: cached, isLoading: false, error: null } : INITIAL);
  }, []);

  const clear = useCallback(() => setState(INITIAL), []);

  return { ...state, generate, showCached, clear };
}
