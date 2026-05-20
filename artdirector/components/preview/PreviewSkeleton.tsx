import type { ImageRatio } from '@/types';

const ASPECT: Record<ImageRatio, string> = {
  landscape_16_9: 'aspect-[16/9]',
  square_hd: 'aspect-square',
  portrait_4_3: 'aspect-[3/4]',
};

export default function PreviewSkeleton({ ratio }: { ratio: ImageRatio }) {
  return (
    <div
      className={`${ASPECT[ratio]} w-full rounded-lg bg-surface-2 border border-border overflow-hidden relative`}
      aria-hidden
    >
      <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-surface-2 via-surface-3 to-surface-2" />
    </div>
  );
}
