import { useState } from 'react';

export interface ModalState {
  // Victory modal
  showVictory: boolean;
  
  // Celebration modal
  showCelebration: boolean;
  celebrationData: {
    games: Array<{name: string, keys: number}>;
    totalKeys: number;
  } | null;
  
  // Draw modal
  showDrawModal: boolean;
  drawSlotIndex: number | null;
  drawnGame: any | null;
  revealedCard: boolean;
  drawnGamesThisSession: number[];
  
  // Steam ID input
  showSteamIdInput: boolean;
  steamIdInputValue: string;
}

export interface ModalActions {
  openVictory: () => void;
  closeVictory: () => void;
  
  openCelebration: (data: { games: Array<{name: string, keys: number}>, totalKeys: number }) => void;
  closeCelebration: () => void;
  
  openDrawModal: (slotIndex: number, game: any) => void;
  closeDrawModal: () => void;
  revealCard: () => void;
  addDrawnGame: (gameId: number) => void;
  setDrawnGamesSession: (games: number[]) => void;
  setDrawnGame: (game: any) => void;
  
  openSteamIdInput: (defaultValue?: string) => void;
  closeSteamIdInput: () => void;
  setSteamIdInputValue: (value: string) => void;
}

export function useModalManager(): [ModalState, ModalActions] {
  // Victory modal
  const [showVictory, setShowVictory] = useState(false);
  
  // Celebration modal
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationData, setCelebrationData] = useState<{games: Array<{name: string, keys: number}>, totalKeys: number} | null>(null);
  
  // Draw modal
  const [showDrawModal, setShowDrawModal] = useState(false);
  const [drawSlotIndex, setDrawSlotIndex] = useState<number | null>(null);
  const [drawnGame, setDrawnGame] = useState<any | null>(null);
  const [revealedCard, setRevealedCard] = useState(false);
  const [drawnGamesThisSession, setDrawnGamesThisSession] = useState<number[]>([]);
  
  // Steam ID input
  const [showSteamIdInput, setShowSteamIdInput] = useState(false);
  const [steamIdInputValue, setSteamIdInputValue] = useState('');
  
  const state: ModalState = {
    showVictory,
    showCelebration,
    celebrationData,
    showDrawModal,
    drawSlotIndex,
    drawnGame,
    revealedCard,
    drawnGamesThisSession,
    showSteamIdInput,
    steamIdInputValue,
  };
  
  const actions: ModalActions = {
    openVictory: () => setShowVictory(true),
    closeVictory: () => setShowVictory(false),
    
    openCelebration: (data) => {
      setCelebrationData(data);
      setShowCelebration(true);
    },
    closeCelebration: () => {
      setShowCelebration(false);
      setCelebrationData(null);
    },
    
    openDrawModal: (slotIndex, game) => {
      setDrawSlotIndex(slotIndex);
      setDrawnGame(game);
      setRevealedCard(false);
      setShowDrawModal(true);
      setDrawnGamesThisSession([game.appid]);
    },
    closeDrawModal: () => {
      setShowDrawModal(false);
      setDrawnGame(null);
      setDrawSlotIndex(null);
      setRevealedCard(false);
      setDrawnGamesThisSession([]);
    },
    revealCard: () => setRevealedCard(true),
    addDrawnGame: (gameId) => setDrawnGamesThisSession(prev => [...prev, gameId]),
    setDrawnGamesSession: (games) => setDrawnGamesThisSession(games),
    setDrawnGame: (game) => setDrawnGame(game),
    
    openSteamIdInput: (defaultValue = '') => {
      setSteamIdInputValue(defaultValue);
      setShowSteamIdInput(true);
    },
    closeSteamIdInput: () => setShowSteamIdInput(false),
    setSteamIdInputValue: (value) => setSteamIdInputValue(value),
  };
  
  return [state, actions];
}
