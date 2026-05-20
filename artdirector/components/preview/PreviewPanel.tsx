'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useImageGen } from '@/hooks/useImageGen';
import { useWizardStore } from '@/store/wizardStore';
import { buildPreviewPrompt, type PreviewSpec } from '@/lib/previewPrompts';
import { getCachedImage } from '@/lib/imageCache';
import PreviewImage from './PreviewImage';
import PreviewSkeleton from './PreviewSkeleton';

const STEP_RE = /\/wizard\/(\d+)/;

function useCurrentStep(): number | null {
  const path = usePathname();
  if (!path) return null;
  const m = path.match(STEP_RE);
  return m ? parseInt(m[1], 10) : null;
}

export default function PreviewPanel() {
  const step = useCurrentStep();
  const state = useWizardStore();
  const { imageUrl, isLoading, error, generate, showCached, clear } = useImageGen();

  const spec: PreviewSpec | null = useMemo(
    () => (step ? buildPreviewPrompt(step, state) : null),
    // Re-derive whenever the step OR any relevant slice of state changes. Cheap to recompute.
    [step, state]
  );

  // When step or spec.prompt changes, show the cached image for that prompt (if any) instead of
  // an unrelated previous result. Clear if no spec.
  useEffect(() => {
    if (!spec) {
      clear();
      return;
    }
    const cached = getCachedImage(spec.ratio, spec.prompt);
    if (cached) showCached(spec.ratio, spec.prompt);
    else clear();
  }, [spec?.prompt, spec?.ratio, clear, showCached, spec]);

  // Hide entirely on steps that have no preview defined. Keeps real estate for the form.
  if (!step) return null;

  return (
    <aside className="hidden lg:flex flex-col gap-3 px-5 py-8 border-l border-border sticky top-0 h-screen overflow-y-auto w-[420px] flex-shrink-0">
      <PreviewPanelInner spec={spec} step={step} imageUrl={imageUrl} isLoading={isLoading} error={error} onGenerate={() => spec && generate(spec)} />
    </aside>
  );
}

/**
 * Same panel content, used for the mobile/tablet placement above the form.
 * Mounted from the wizard layout so it appears in a sensible spot on narrow viewports.
 */
export function PreviewPanelMobile() {
  const step = useCurrentStep();
  const state = useWizardStore();
  const { imageUrl, isLoading, error, generate, showCached, clear } = useImageGen();
  const spec: PreviewSpec | null = useMemo(
    () => (step ? buildPreviewPrompt(step, state) : null),
    [step, state]
  );

  useEffect(() => {
    if (!spec) {
      clear();
      return;
    }
    const cached = getCachedImage(spec.ratio, spec.prompt);
    if (cached) showCached(spec.ratio, spec.prompt);
    else clear();
  }, [spec?.prompt, spec?.ratio, clear, showCached, spec]);

  if (!step || !spec) return null;

  return (
    <div className="lg:hidden mb-6 border border-border rounded-lg p-4 bg-surface">
      <PreviewPanelInner spec={spec} step={step} imageUrl={imageUrl} isLoading={isLoading} error={error} onGenerate={() => generate(spec)} compact />
    </div>
  );
}

interface InnerProps {
  spec: PreviewSpec | null;
  step: number;
  imageUrl: string | null;
  isLoading: boolean;
  error: string | null;
  onGenerate: () => void;
  compact?: boolean;
}

function PreviewPanelInner({ spec, step, imageUrl, isLoading, error, onGenerate, compact }: InnerProps) {
  return (
    <>
      <div className="text-[10px] font-bold tracking-[.1em] uppercase text-text-3">
        Live preview · step {step}
      </div>

      {!spec ? (
        <div className="text-[12px] text-text-3 italic leading-[1.6] mt-1">
          Make a selection on this step to enable preview generation.
        </div>
      ) : (
        <>
          <div className="text-[13px] text-text font-semibold leading-[1.4]">{spec.label}</div>

          {/* Image / loading / placeholder */}
          {isLoading ? (
            <PreviewSkeleton ratio={spec.ratio} />
          ) : imageUrl ? (
            <PreviewImage url={imageUrl} ratio={spec.ratio} />
          ) : (
            <PreviewSkeleton ratio={spec.ratio} />
          )}

          {error && (
            <div className="text-[11px] text-aaa-t bg-aaa/30 border border-aaa-b rounded px-2.5 py-2 leading-[1.5]">
              {error}
            </div>
          )}

          <button
            type="button"
            className="btn btn-primary"
            onClick={onGenerate}
            disabled={isLoading}
          >
            {isLoading ? 'Generating…' : imageUrl ? 'Regenerate preview' : 'Generate preview'}
          </button>

          {!compact && (
            <details className="text-[11px] text-text-3 leading-[1.5] mt-1">
              <summary className="cursor-pointer hover:text-text-2 select-none">
                View prompt
              </summary>
              <p className="mt-2 font-mono text-[10.5px] text-text-2 bg-surface-2 border border-border rounded p-2 leading-[1.55] whitespace-pre-wrap break-words">
                {spec.prompt}
              </p>
            </details>
          )}
        </>
      )}
    </>
  );
}
