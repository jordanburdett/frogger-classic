import GameCanvas from './components/GameCanvas.tsx'
import './App.css'

export default function App() {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0f0a',
      }}
    >
      <GameCanvas />
    </main>
  )
}
