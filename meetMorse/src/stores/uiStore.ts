import { create } from 'zustand';

export type View = 'home' | 'game';

interface UIState {
  view: View;
  setView: (view: View) => void;
}

export const useUIStore = create<UIState>((set) => ({
  view: 'home',
  setView: (view) => set({ view }),
}));
