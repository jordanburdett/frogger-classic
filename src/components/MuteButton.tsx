interface MuteButtonProps {
  muted: boolean
  onToggle: () => void
}

export default function MuteButton({ muted, onToggle }: MuteButtonProps) {
  return (
    <button
      onClick={onToggle}
      aria-label={muted ? 'Unmute sound' : 'Mute sound'}
      title={muted ? 'Unmute (M)' : 'Mute (M)'}
      style={{
        position: 'absolute',
        top: 8,
        right: 8,
        width: 36,
        height: 36,
        background: 'rgba(0,0,0,0.5)',
        border: '1px solid rgba(255,255,255,0.2)',
        borderRadius: 6,
        color: '#fff',
        cursor: 'pointer',
        fontSize: '1.1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 15,
        padding: 0,
      }}
    >
      {muted ? '🔇' : '🔊'}
    </button>
  )
}
