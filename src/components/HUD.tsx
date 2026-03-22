interface HUDProps {
  score: number
  lives: number
  level: number
}

export default function HUD({ score, lives, level }: HUDProps) {
  return (
    <div
      aria-label="Game HUD"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '4px 12px',
        background: 'rgba(10,20,10,0.75)',
        fontFamily: 'monospace',
        color: '#fff',
        fontSize: '0.9rem',
        pointerEvents: 'none',
        zIndex: 5,
      }}
    >
      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
        {Array.from({ length: lives }).map((_, i) => (
          <span key={i} aria-label="life" style={{ fontSize: '1rem' }}>🐸</span>
        ))}
        {lives === 0 && <span style={{ color: '#aaa', fontSize: '0.8rem' }}>—</span>}
      </div>

      <div style={{ color: '#FFD700', fontWeight: 'bold', fontSize: '1rem' }}>
        {score}
      </div>

      <div style={{ color: '#aaa', fontSize: '0.85rem' }}>
        LVL {level}
      </div>
    </div>
  )
}
