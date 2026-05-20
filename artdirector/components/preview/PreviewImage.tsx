'use client';

import type { ImageRatio } from '@/types';

const ASPECT: Record<ImageRatio, string> = {
  landscape_16_9: 'aspect-[16/9]',
  square_hd: 'aspect-square',
  portrait_4_3: 'aspect-[3/4]',
};

interface Props {
  url: string;
  ratio: ImageRatio;
  faded?: boolean;
}

export default function PreviewImage({ url, ratio, faded }: Props) {
  return (
    <div className={`${ASPECT[ratio]} w-full rounded-lg overflow-hidden bg-surface-2 border border-border`}>
      {/* Using <img> rather than next/image — fal.media URLs are dynamic, ratio-aware sizing is handled by the container. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt="Generated preview"
        className={`w-full h-full object-cover transition-opacity duration-200 ${faded ? 'opacity-40' : 'opacity-100'}`}
      />
    </div>
  );
}
