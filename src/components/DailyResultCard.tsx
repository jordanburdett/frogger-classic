import { buildEmojiRow, buildShareText } from '../game/daily.ts'
import type { DailyResult } from '../game/daily.ts'
import { useState } from 'react'

interface DailyResultCardProps {
  result: DailyResult
  onPlayAgain?: () => void
  onMenu: () => void
}

export default function DailyResultCard({ result, onMenu }: DailyResultCardProps) {
  const [copied, setCopied] = useState(false)
  const emojiRow = buildEmojiRow(result.attempts)

  function handleShare() {
    const text = buildShareText(result)
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {
      // Fallback: prompt
      window.prompt('Copy the text below:', text)
    })
  }

  return (
    <div
      role="dialog"
      aria-label="Daily Challenge Result"
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(10, 20, 10, 0.93)',
        color: '#fff',
        fontFamily: "'Press Start 2P', monospace",
        zIndex: 10,
        gap: '0.75rem',
        padding: '1rem',
      }}
    >
      <div style={{ fontSize: '1rem', color: '#5A8C3E', textAlign: 'center', lineHeight: 1.6 }}>
        DAILY CHALLENGE
      </div>

      <div style={{ fontSize: '1.5rem', color: '#FFD700', textAlign: 'center' }}>
        {result.frogsHome}/5 🐸 home
      </div>

      <div style={{ fontSize: '0.85rem', color: '#aaa', textAlign: 'center' }}>
        Score: {result.finalScore}
      </div>

      <div
        style={{
          fontSize: '1.6rem',
          letterSpacing: '0.15em',
          background: 'rgba(255,255,255,0.06)',
          padding: '0.5rem 1rem',
          borderRadius: 8,
          border: '1px solid rgba(255,255,255,0.15)',
        }}
        aria-label="Result emoji row"
      >
        {emojiRow}
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          onClick={handleShare}
          style={btnStyle('#4A7CBB')}
          aria-label="Share result"
        >
          {copied ? '✓ Copied!' : 'Share'}
        </button>
        <button
          onClick={onMenu}
          style={btnStyle('#555')}
          aria-label="Return to menu"
        >
          Menu
        </button>
      </div>

      <div style={{ fontSize: '0.55rem', color: '#555', marginTop: '0.25rem', textAlign: 'center' }}>
        Come back tomorrow for a new challenge
      </div>
    </div>
  )
}

function btnStyle(bg: string): React.CSSProperties {
  return {
    padding: '0.6rem 1.25rem',
    background: bg,
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    cursor: 'pointer',
    fontFamily: "'Press Start 2P', monospace",
    fontSize: '0.65rem',
    fontWeight: 'bold',
    minWidth: 100,
  }
}
