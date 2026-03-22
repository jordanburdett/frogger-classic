import { useEffect, useRef, useState, useCallback } from 'react'
import { GameEngine } from '../game/GameEngine.ts'
import { GameState } from '../game/types.ts'
import type { GameMode } from '../game/types.ts'
import { CANVAS_W, CANVAS_H } from '../game/constants.ts'
import ModeSelector from './ModeSelector.tsx'
import GameOver from './GameOver.tsx'
import HUD from './HUD.tsx'

// Tick counter triggers React re-render for HUD updates
interface EngineSnapshot {
  state: GameState
  score: number
  lives: number
  level: number
  bestScore: number
}

function snap(engine: GameEngine): EngineSnapshot {
  return {
    state: engine.state,
    score: engine.score,
    lives: engine.lives,
    level: engine.level,
    bestScore: engine.bestScore,
  }
}

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<GameEngine | null>(null)
  const rafRef = useRef<number>(0)

  const [ui, setUi] = useState<EngineSnapshot>({
    state: GameState.MODE_SELECT,
    score: 0,
    lives: 3,
    level: 1,
    bestScore: 0,
  })

  // Initialize engine
  useEffect(() => {
    const engine = new GameEngine()
    engineRef.current = engine
    setUi(snap(engine))
    return () => {
      engine.destroy()
      cancelAnimationFrame(rafRef.current)
    }
  }, [])

  // RAF loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let frameCount = 0

    function loop(ts: number) {
      if (!engineRef.current || !ctx) return
      const engine = engineRef.current

      engine.tick(ts)
      engine.render(ctx)

      frameCount++
      // Sync React UI every 6 frames (~10fps) to avoid thrashing
      if (frameCount % 6 === 0) {
        setUi(snap(engine))
      }

      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  const handleModeSelect = useCallback((mode: GameMode) => {
    engineRef.current?.startGame(mode)
    setUi(snap(engineRef.current!))
  }, [])

  const handlePlayAgain = useCallback(() => {
    engineRef.current?.restartGame()
    setUi(snap(engineRef.current!))
  }, [])

  const handleMenu = useCallback(() => {
    engineRef.current?.goToMenu()
    setUi(snap(engineRef.current!))
  }, [])

  return (
    <div
      style={{
        position: 'relative',
        width: CANVAS_W,
        height: CANVAS_H,
        margin: '0 auto',
      }}
    >
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        aria-label="Frogger game board"
        role="img"
        style={{ display: 'block' }}
      />

      {ui.state === GameState.PLAYING && (
        <HUD score={ui.score} lives={ui.lives} level={ui.level} />
      )}

      {ui.state === GameState.MODE_SELECT && (
        <ModeSelector onSelect={handleModeSelect} />
      )}

      {ui.state === GameState.GAME_OVER && (
        <GameOver
          score={ui.score}
          bestScore={ui.bestScore}
          onPlayAgain={handlePlayAgain}
          onMenu={handleMenu}
        />
      )}
    </div>
  )
}
