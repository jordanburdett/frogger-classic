import { Direction } from '../game/types.ts'

interface DPadProps {
  onDirection: (dir: Direction) => void
}

const BTN_SIZE = 72

const buttonStyle: React.CSSProperties = {
  width: BTN_SIZE,
  height: BTN_SIZE,
  background: 'rgba(255,255,255,0.15)',
  border: '2px solid rgba(255,255,255,0.3)',
  borderRadius: 8,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '1.75rem',
  color: '#fff',
  cursor: 'pointer',
  userSelect: 'none',
  WebkitUserSelect: 'none',
  touchAction: 'none',
  flexShrink: 0,
}

export default function DPad({ onDirection }: DPadProps) {
  function makePointerDown(dir: Direction) {
    return (e: React.PointerEvent) => {
      e.preventDefault()
      onDirection(dir)
    }
  }

  return (
    <div
      aria-label="D-pad controls"
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'grid',
        gridTemplateColumns: `${BTN_SIZE}px ${BTN_SIZE}px ${BTN_SIZE}px`,
        gridTemplateRows: `${BTN_SIZE}px ${BTN_SIZE}px`,
        gap: 6,
        zIndex: 20,
      }}
    >
      {/* Top row: empty, UP, empty */}
      <div />
      <button
        aria-label="Move up"
        style={buttonStyle}
        onPointerDown={makePointerDown(Direction.UP)}
      >
        ▲
      </button>
      <div />

      {/* Bottom row: LEFT, DOWN, RIGHT */}
      <button
        aria-label="Move left"
        style={buttonStyle}
        onPointerDown={makePointerDown(Direction.LEFT)}
      >
        ◀
      </button>
      <button
        aria-label="Move down"
        style={buttonStyle}
        onPointerDown={makePointerDown(Direction.DOWN)}
      >
        ▼
      </button>
      <button
        aria-label="Move right"
        style={buttonStyle}
        onPointerDown={makePointerDown(Direction.RIGHT)}
      >
        ▶
      </button>
    </div>
  )
}
