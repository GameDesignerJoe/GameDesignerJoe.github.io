import ArtBibleSidebar from '@/components/wizard/ArtBibleSidebar';
import HydrationGate from '@/components/HydrationGate';
import PreviewPanel, { PreviewPanelMobile } from '@/components/preview/PreviewPanel';

export default function WizardLayout({ children }: { children: React.ReactNode }) {
  return (
    <HydrationGate>
      <div className="grid min-h-screen grid-cols-1 md:grid-cols-[var(--sidebar)_1fr] lg:grid-cols-[var(--sidebar)_minmax(0,1fr)_420px]">
        <ArtBibleSidebar />
        <main className="flex flex-col px-5 pt-8 pb-28 md:px-10 md:pb-28 w-full max-w-wizard">
          <PreviewPanelMobile />
          {children}
        </main>
        <PreviewPanel />
      </div>
    </HydrationGate>
  );
}
