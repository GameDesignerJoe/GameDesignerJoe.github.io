import { GameScreen } from './screens/GameScreen';
import { HomeScreen } from './screens/HomeScreen';
import { useUIStore } from './stores/uiStore';

export default function App() {
  const view = useUIStore((s) => s.view);
  return view === 'home' ? <HomeScreen /> : <GameScreen />;
}
