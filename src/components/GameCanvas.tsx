import { useEffect, useRef, useState, useCallback } from 'react'
import { GameEngine } from '../game/GameEngine.ts'
import { GameState, Direction } from '../game/types.ts'
import type { GameMode } from '../game/types.ts'
import { CANVAS_W, CANVAS_H } from '../game/constants.ts'
import { AudioEngine } from '../game/audio.ts'
import { generateDailyConfig, getDailyKey, getDailyResult, saveDailyResult } from '../game/daily.ts'
import type { DailyResult } from '../game/daily.ts'
import { isTouchDevice } from '../utils/device.ts'
import { GameMode as GameModeConst } from '../game/types.ts'
import ModeSelector from './ModeSelector.tsx'
import GameOver from './GameOver.tsx'
import HUD from './HUD.tsx'
import DPad from './DPad.tsx'
import DailyResultCard from './DailyResultCard.tsx'
import MuteButton from './MuteButton.tsx'

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

const SWIPE_THRESHOLD = 30

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<GameEngine | null>(null)
  const rafRef = useRef<number>(0)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)

  // AudioEngine stored in state (NOT useRef) per react-hooks/refs v7 constraint
  const [audio] = useState(() => new AudioEngine())
  const [muted, setMuted] = useState(false)
  const [isTouch] = useState(() => isTouchDevice())

  const [ui, setUi] = useState<EngineSnapshot>({
    state: GameState.MODE_SELECT,
    score: 0,
    lives: 3,
    level: 1,
    bestScore: 0,
  })

  // Daily result card state
  const [dailyResult, setDailyResult] = useState<DailyResult | null>(null)
  const [showDailyResult, setShowDailyResult] = useState(false)

  // Initialize engine
  useEffect(() => {
    const engine = new GameEngine()
    engineRef.current = engine

    // Wire audio callbacks
    engine.audioCallbacks = {
      onHop: () => audio.playHop(),
      onSplashDeath: () => audio.playSplashDeath(),
      onSquishDeath: () => audio.playSquishDeath(),
      onHomeFill: () => audio.playHomeFill(),
      onLevelClear: () => audio.playLevelClear(),
    }

    setUi(snap(engine))
    return () => {
      engine.destroy()
      cancelAnimationFrame(rafRef.current)
      audio.destroy()
    }
  }, [audio])

  // Mute key handler
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'm' || e.key === 'M') {
        const newMuted = audio.toggleMute()
        setMuted(newMuted)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [audio])

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
        const snapshot = snap(engine)
        setUi(prev => {
          // Only trigger a re-render if something changed
          if (
            prev.state !== snapshot.state ||
            prev.score !== snapshot.score ||
            prev.lives !== snapshot.lives ||
            prev.level !== snapshot.level
          ) {
            return snapshot
          }
          return prev
        })

        // Check for game over in daily mode — save result
        if (engine.state === GameState.GAME_OVER && engine.mode === GameModeConst.DAILY) {
          const dateKey = getDailyKey()
          const existing = getDailyResult(dateKey)
          if (!existing) {
            const result: DailyResult = {
              dateKey,
              frogsHome: engine.homeAttemptResults.filter(a => a === 'safe').length,
              finalScore: engine.score,
              attempts: [...engine.homeAttemptResults],
            }
            saveDailyResult(result)
            setDailyResult(result)
            setShowDailyResult(true)
          }
        }
      }

      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  // Touch swipe detection (attached to canvas container)
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0]
    touchStartRef.current = { x: touch.clientX, y: touch.clientY }
  }, [])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return
    const touch = e.changedTouches[0]
    const dx = touch.clientX - touchStartRef.current.x
    const dy = touch.clientY - touchStartRef.current.y
    touchStartRef.current = null

    const absDx = Math.abs(dx)
    const absDy = Math.abs(dy)
    const maxDelta = Math.max(absDx, absDy)

    if (maxDelta < SWIPE_THRESHOLD) return

    let dir: Direction
    if (absDx > absDy) {
      dir = dx > 0 ? Direction.RIGHT : Direction.LEFT
    } else {
      dir = dy > 0 ? Direction.DOWN : Direction.UP
    }

    engineRef.current?.pushDirection(dir)
  }, [])

  const handleDPadDirection = useCallback((dir: Direction) => {
    engineRef.current?.pushDirection(dir)
  }, [])

  const handleModeSelect = useCallback((mode: GameMode) => {
    if (mode === GameModeConst.DAILY) {
      // Check if already played today
      const dateKey = getDailyKey()
      const existing = getDailyResult(dateKey)
      if (existing) {
        setDailyResult(existing)
        setShowDailyResult(true)
        return
      }
      const dailyConfig = generateDailyConfig()
      engineRef.current?.startGame(mode, dailyConfig)
    } else {
      engineRef.current?.startGame(mode, null)
    }
    setUi(snap(engineRef.current!))
  }, [])

  const handlePlayAgain = useCallback(() => {
    setShowDailyResult(false)
    engineRef.current?.restartGame()
    setUi(snap(engineRef.current!))
  }, [])

  const handleMenu = useCallback(() => {
    setShowDailyResult(false)
    setDailyResult(null)
    engineRef.current?.goToMenu()
    setUi(snap(engineRef.current!))
  }, [])

  const handleMuteToggle = useCallback(() => {
    const newMuted = audio.toggleMute()
    setMuted(newMuted)
  }, [audio])

  return (
    <div
      style={{
        position: 'relative',
        width: CANVAS_W,
        height: CANVAS_H,
        margin: '0 auto',
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
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

      <MuteButton muted={muted} onToggle={handleMuteToggle} />

      {ui.state === GameState.MODE_SELECT && !showDailyResult && (
        <ModeSelector onSelect={handleModeSelect} />
      )}

      {showDailyResult && dailyResult && (
        <DailyResultCard
          result={dailyResult}
          onMenu={handleMenu}
        />
      )}

      {ui.state === GameState.GAME_OVER && !showDailyResult && (
        <GameOver
          score={ui.score}
          bestScore={ui.bestScore}
          onPlayAgain={handlePlayAgain}
          onMenu={handleMenu}
        />
      )}

      {isTouch && ui.state === GameState.PLAYING && (
        <DPad onDirection={handleDPadDirection} />
      )}
    </div>
  )
}
