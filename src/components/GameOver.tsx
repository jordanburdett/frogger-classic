interface GameOverProps {
  score: number
  bestScore: number
  onPlayAgain: () => void
  onMenu: () => void
}

export default function GameOver({ score, bestScore, onPlayAgain, onMenu }: GameOverProps) {
  const isNewBest = score >= bestScore && score > 0

  return (
    <div
      role="dialog"
      aria-label="Game Over"
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(10, 5, 5, 0.88)',
        color: '#fff',
        fontFamily: 'monospace',
        zIndex: 10,
      }}
    >
      <h2 style={{ fontSize: '2.5rem', color: '#FF4444', marginBottom: '0.5rem', letterSpacing: '0.1em' }}>
        GAME OVER
      </h2>

      {isNewBest && (
        <p style={{ color: '#FFD700', fontWeight: 'bold', marginBottom: '0.25rem' }}>
          NEW BEST!
        </p>
      )}

      <p style={{ fontSize: '1.5rem', color: '#FFD700', margin: '0.5rem 0' }}>
        Score: {score}
      </p>
      <p style={{ fontSize: '1rem', color: '#aaa', marginBottom: '2rem' }}>
        Best: {bestScore}
      </p>

      <div style={{ display: 'flex', gap: '1rem' }}>
        <button
          onClick={onPlayAgain}
          style={btnStyle('#5A8C3E')}
          aria-label="Play Again"
        >
          Play Again
        </button>
        <button
          onClick={onMenu}
          style={btnStyle('#555')}
          aria-label="Return to Menu"
        >
          Menu
        </button>
      </div>
    </div>
  )
}

function btnStyle(bg: string): React.CSSProperties {
  return {
    padding: '0.75rem 2rem',
    background: bg,
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    cursor: 'pointer',
    fontFamily: 'monospace',
    fontSize: '1rem',
    fontWeight: 'bold',
  }
}
