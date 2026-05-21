'use client';

import { useEffect, useState } from 'react';
import ImageChoice from './ImageChoice';
import { getCachedImage, setCachedImage } from '@/lib/imageCache';

interface RoundImageState {
  url: string | null;
  loading: boolean;
  error: string | null;
}

const INITIAL_IMG: RoundImageState = { url: null, loading: true, error: null };

interface Props {
  promptA: string;
  promptB: string;
  onChoose: (chosen: 'A' | 'B') => void;
}

/**
 * Renders one round of the convergence flow. Owns image-gen lifecycle for its
 * two options. Cached results are shown synchronously; otherwise both calls fire
 * in parallel on mount (and on prompt change).
 */
export default function ConvergenceRound({ promptA, promptB, onChoose }: Props) {
  const [a, setA] = useState<RoundImageState>(INITIAL_IMG);
  const [b, setB] = useState<RoundImageState>(INITIAL_IMG);

  useEffect(() => {
    let cancelled = false;

    async function fetchSide(prompt: string, setter: (s: RoundImageState) => void) {
      const cached = getCachedImage('landscape_16_9', prompt);
      if (cached) {
        setter({ url: cached, loading: false, error: null });
        return;
      }
      setter({ url: null, loading: true, error: null });
      try {
        const res = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, ratio: 'landscape_16_9', quality: 'fast' }),
        });
        const data: { imageUrl?: string; error?: string } = await res.json();
        if (cancelled) return;
        if (!res.ok || !data.imageUrl) {
          setter({ url: null, loading: false, error: data.error || `HTTP ${res.status}` });
          return;
        }
        setCachedImage('landscape_16_9', prompt, data.imageUrl);
        setter({ url: data.imageUrl, loading: false, error: null });
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : 'Network error';
        setter({ url: null, loading: false, error: msg });
      }
    }

    void fetchSide(promptA, setA);
    void fetchSide(promptB, setB);

    return () => {
      cancelled = true;
    };
  }, [promptA, promptB]);

  // Disable selection until both sides resolved (success or failure). Letting
  // the user pick while one side is still loading would skew the choice.
  const bothSettled = !a.loading && !b.loading;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <ImageChoice
        letter="A"
        imageUrl={a.url}
        isLoading={a.loading}
        error={a.error}
        onChoose={() => onChoose('A')}
        disabled={!bothSettled || !a.url}
      />
      <ImageChoice
        letter="B"
        imageUrl={b.url}
        isLoading={b.loading}
        error={b.error}
        onChoose={() => onChoose('B')}
        disabled={!bothSettled || !b.url}
      />
    </div>
  );
}
