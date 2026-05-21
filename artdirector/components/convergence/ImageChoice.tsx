'use client';

import PreviewSkeleton from '@/components/preview/PreviewSkeleton';

interface Props {
  letter: 'A' | 'B';
  imageUrl: string | null;
  isLoading: boolean;
  error: string | null;
  onChoose: () => void;
  disabled: boolean;
}

export default function ImageChoice({ letter, imageUrl, isLoading, error, onChoose, disabled }: Props) {
  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        {isLoading || !imageUrl ? (
          <PreviewSkeleton ratio="landscape_16_9" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={`Option ${letter}`}
            className="w-full aspect-[16/9] object-cover rounded-lg border border-border"
          />
        )}
        <div className="absolute top-2 left-2 bg-bg/85 border border-border-strong rounded px-2 py-0.5 text-[11px] font-bold text-text uppercase tracking-[.1em]">
          {letter}
        </div>
        {error && (
          <div className="absolute inset-x-2 bottom-2 text-[10px] text-aaa-t bg-aaa/40 border border-aaa-b rounded px-2 py-1 leading-[1.4]">
            {error}
          </div>
        )}
      </div>

      <button
        type="button"
        className="btn btn-primary w-full"
        onClick={onChoose}
        disabled={disabled}
      >
        This one — {letter}
      </button>
    </div>
  );
}
