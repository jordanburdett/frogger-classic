import { GameMode } from '../game/types.ts'
import type { GameMode as GameModeType } from '../game/types.ts'

interface ModeSelectorProps {
  onSelect: (mode: GameModeType) => void
}

export default function ModeSelector({ onSelect }: ModeSelectorProps) {
  return (
    <div
      role="dialog"
      aria-label="Select game mode"
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(10, 20, 10, 0.92)',
        color: '#fff',
        fontFamily: 'monospace',
        zIndex: 10,
      }}
    >
      <h1 style={{ fontSize: '2.5rem', color: '#5A8C3E', marginBottom: '0.25rem', textShadow: '0 0 12px #5A8C3E' }}>
        FROGGER
      </h1>
      <p style={{ color: '#aaa', marginBottom: '2.5rem', fontSize: '0.95rem' }}>
        Cross the road. Don't get squished.
      </p>

      <div style={{ display: 'flex', gap: '1.5rem' }}>
        <button
          onClick={() => onSelect(GameMode.CLASSIC)}
          style={btnStyle('#5A8C3E')}
          aria-label="Play Classic Mode"
        >
          <span style={{ fontSize: '2rem' }}>🐸</span>
          <span style={{ display: 'block', fontWeight: 'bold', marginTop: '0.5rem' }}>CLASSIC</span>
          <span style={{ display: 'block', fontSize: '0.75rem', color: '#ccc', marginTop: '0.25rem' }}>
            Endless arcade fun
          </span>
        </button>

        <button
          onClick={() => onSelect(GameMode.DAILY)}
          style={btnStyle('#4A7CBB')}
          aria-label="Play Daily Challenge Mode"
        >
          <span style={{ fontSize: '2rem' }}>📅</span>
          <span style={{ display: 'block', fontWeight: 'bold', marginTop: '0.5rem' }}>DAILY</span>
          <span style={{ display: 'block', fontSize: '0.75rem', color: '#ccc', marginTop: '0.25rem' }}>
            Today's challenge
          </span>
        </button>
      </div>

      <p style={{ marginTop: '2rem', fontSize: '0.75rem', color: '#666' }}>
        Arrow keys or WASD to move
      </p>
    </div>
  )
}

function btnStyle(accent: string): React.CSSProperties {
  return {
    padding: '1.25rem 2rem',
    background: 'rgba(255,255,255,0.06)',
    border: `2px solid ${accent}`,
    borderRadius: '12px',
    color: '#fff',
    cursor: 'pointer',
    fontFamily: 'monospace',
    fontSize: '1rem',
    minWidth: '140px',
    transition: 'background 0.15s, transform 0.1s',
  }
}
