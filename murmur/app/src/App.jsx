import { useStore } from './store'
import Nav from './components/Nav/Nav'
import Library from './components/Library/Library'
import Detail from './components/Detail/Detail'
import Player from './components/Player/Player'
import Creator from './components/Creator/Creator'

export default function App() {
  const view = useStore(s => s.view)

  return (
    <>
      <Nav />
      <Library />
      <Detail />
      <Player />
      <Creator />
    </>
  )
}
