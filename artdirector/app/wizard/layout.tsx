import ArtBibleSidebar from '@/components/wizard/ArtBibleSidebar';
import HydrationGate from '@/components/HydrationGate';

export default function WizardLayout({ children }: { children: React.ReactNode }) {
  return (
    <HydrationGate>
      <div className="grid min-h-screen grid-cols-1 md:grid-cols-[var(--sidebar)_1fr]">
        <ArtBibleSidebar />
        <main className="flex flex-col px-5 pt-8 pb-28 md:px-10 md:pb-28 max-w-wizard w-full">
          {children}
        </main>
      </div>
    </HydrationGate>
  );
}
