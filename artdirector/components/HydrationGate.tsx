'use client';

import { useEffect, useState } from 'react';
import { useWizardStore } from '@/store/wizardStore';

export default function HydrationGate({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    void useWizardStore.persist.rehydrate();
    setHydrated(true);
  }, []);

  if (!hydrated) return null;
  return <>{children}</>;
}
