import { Direction, GameState } from './types.ts'
import type { FrogState, VehicleState, RiverEntity, HomeSlot, GameMode } from './types.ts'
import {
  COLS,
  FROG_START_COL,
  FROG_START_ROW,
  INITIAL_LIVES,
  DEATH_FLASH_FRAMES,
  SCORE_PER_ROW,
  SCORE_HOME_BASE,
  SCORE_TIME_BONUS_PER_SEC,
  DELTA_CAP_MS,
  LEVEL_TIMER_SECONDS,
  LEVEL_SPEED_MULTIPLIER,
  LANE_CONFIGS,
  RIVER_LANE_CONFIGS,
  ROAD_ROWS,
  RIVER_ROWS,
  CANVAS_W,
  CANVAS_H,
  TILE_SIZE,
  COLOR_ROAD,
  COLOR_GRASS,
  COLOR_LANE_LINE,
  COLOR_FROG_BODY,
  COLOR_FROG_BELLY,
  COLOR_FROG_EYE,
  COLOR_FROG_DEAD,
  COLOR_CAR_BODY,
  COLOR_CAR_WINDOW,
  COLOR_TRUCK_BODY,
  COLOR_TRUCK_WINDOW,
  COLOR_RIVER,
  COLOR_HOME_ROW,
  COLOR_LOG,
  COLOR_LILY_PAD,
  COLOR_SNAKE,
  COLOR_SNAKE_HEAD,
  COLOR_TIMER_NORMAL,
  COLOR_TIMER_URGENT,
} from './constants.ts'
import { VehicleType } from './types.ts'
import { createLaneVehicles, updateVehicle, checkVehicleCollision } from './vehicles.ts'
import {
  createRiverLaneEntities,
  updateRiverEntity,
  findRidingEntity,
  isOnSnake,
  createHomeSlots,
  checkHomeSlot,
  allHomesFilled,
} from './river.ts'
import type { DailyConfig, HomeAttemptResult } from './daily.ts'

// Hop animation constants
const HOP_DURATION_MS = 100
const SQUASH_DURATION_MS = 80

// Death cause type (for audio callback differentiation)
export const DeathCause = {
  VEHICLE: 'vehicle',
  WATER: 'water',
  TIMER: 'timer',
} as const
export type DeathCause = typeof DeathCause[keyof typeof DeathCause]

// Audio callbacks injected from outside (avoids AudioEngine import coupling)
export interface AudioCallbacks {
  onHop?: () => void
  onSplashDeath?: () => void
  onSquishDeath?: () => void
  onHomeFill?: () => void
  onLevelClear?: () => void
}

function makeFrog(): FrogState {
  return {
    col: FROG_START_COL,
    row: FROG_START_ROW,
    x: FROG_START_COL * TILE_SIZE,
    facing: Direction.UP,
    deathFlashFrames: 0,
    alive: true,
    hopProgress: 1,
    hopScale: { x: 1, y: 1 },
  }
}

export class GameEngine {
  state: GameState = GameState.MODE_SELECT
  mode: GameMode | null = null

  frog: FrogState = makeFrog()
  vehicles: VehicleState[] = []
  riverEntities: RiverEntity[] = []
  homes: HomeSlot[] = createHomeSlots()

  lives: number = INITIAL_LIVES
  score: number = 0
  bestScore: number = 0
  level: number = 1

  // Timer state
  timerSeconds: number = LEVEL_TIMER_SECONDS
  private timerElapsedMs: number = 0

  // Level clear overlay
  levelClearFrames: number = 0
  private readonly LEVEL_CLEAR_FRAMES = 120 // 2 seconds at 60fps

  private pendingDirection: Direction = Direction.NONE
  private lastTimestamp: number | null = null
  // Track time for ripple animation
  private elapsedSec: number = 0

  // Hop animation
  private hopStartRow: number = FROG_START_ROW
  private hopTargetRow: number = FROG_START_ROW
  private squashTimeMs: number = 0

  // Daily challenge
  private dailyConfig: DailyConfig | null = null
  // homeAttemptResults tracks per-slot outcomes for daily mode
  homeAttemptResults: HomeAttemptResult[] = Array(5).fill('unreached')

  // Audio callbacks (wired by GameCanvas)
  audioCallbacks: AudioCallbacks = {}

  private boundKeyHandler: (e: KeyboardEvent) => void

  constructor() {
    this.boundKeyHandler = this.handleKey.bind(this)
    window.addEventListener('keydown', this.boundKeyHandler)
    this.loadBestScore()
  }

  destroy(): void {
    window.removeEventListener('keydown', this.boundKeyHandler)
  }

  private loadBestScore(): void {
    try {
      const stored = localStorage.getItem('frogger_best_score')
      if (stored) this.bestScore = parseInt(stored, 10) || 0
    } catch {
      // localStorage unavailable
    }
  }

  private saveBestScore(): void {
    try {
      if (this.score > this.bestScore) {
        this.bestScore = this.score
        localStorage.setItem('frogger_best_score', String(this.bestScore))
      }
    } catch {
      // localStorage unavailable
    }
  }

  startGame(mode: GameMode, dailyConfig: DailyConfig | null = null): void {
    this.mode = mode
    this.dailyConfig = dailyConfig
    this.lives = INITIAL_LIVES
    this.score = 0
    this.level = 1
    this.frog = makeFrog()
    this.homeAttemptResults = Array(5).fill('unreached')
    this.vehicles = this.buildVehicles(1)
    this.riverEntities = this.buildRiverEntities(1)
    this.homes = createHomeSlots()
    this.timerSeconds = LEVEL_TIMER_SECONDS
    this.timerElapsedMs = 0
    this.levelClearFrames = 0
    this.lastTimestamp = null
    this.elapsedSec = 0
    this.squashTimeMs = 0
    this.state = GameState.PLAYING
  }

  restartGame(): void {
    if (this.mode) this.startGame(this.mode, this.dailyConfig)
  }

  goToMenu(): void {
    this.state = GameState.MODE_SELECT
    this.pendingDirection = Direction.NONE
  }

  /** Called externally (GameCanvas) to inject a direction from touch/swipe. */
  pushDirection(dir: Direction): void {
    if (this.state === GameState.PLAYING) {
      this.pendingDirection = dir
    }
  }

  private handleKey(e: KeyboardEvent): void {
    if (this.state !== GameState.PLAYING) return
    switch (e.key) {
      case 'ArrowUp':    case 'w': case 'W': this.pendingDirection = Direction.UP;    e.preventDefault(); break
      case 'ArrowDown':  case 's': case 'S': this.pendingDirection = Direction.DOWN;  e.preventDefault(); break
      case 'ArrowLeft':  case 'a': case 'A': this.pendingDirection = Direction.LEFT;  e.preventDefault(); break
      case 'ArrowRight': case 'd': case 'D': this.pendingDirection = Direction.RIGHT; e.preventDefault(); break
    }
  }

  /** Build vehicles for a given level, optionally using daily config round. */
  private buildVehicles(level: number): VehicleState[] {
    const roundIdx = level - 1
    if (this.dailyConfig && roundIdx < this.dailyConfig.rounds.length) {
      const round = this.dailyConfig.rounds[roundIdx]
      return LANE_CONFIGS.flatMap((lane, i) => {
        const speedMul = round.laneSpeedMultipliers[i] ?? 1
        const count = round.vehicleCounts[i] ?? lane.vehicleCount
        return createLaneVehicles({
          ...lane,
          baseSpeed: lane.baseSpeed * speedMul,
          vehicleCount: count,
        })
      })
    }
    const levelMultiplier = Math.pow(LEVEL_SPEED_MULTIPLIER, level - 1)
    return LANE_CONFIGS.flatMap(lane =>
      createLaneVehicles({ ...lane, baseSpeed: lane.baseSpeed * levelMultiplier })
    )
  }

  /** Build river entities for a given level, optionally using daily config round. */
  private buildRiverEntities(level: number): RiverEntity[] {
    const roundIdx = level - 1
    if (this.dailyConfig && roundIdx < this.dailyConfig.rounds.length) {
      const round = this.dailyConfig.rounds[roundIdx]
      return RIVER_LANE_CONFIGS.flatMap((lane, i) => {
        const widthOverride = round.logWidthTiles[i]
        return createRiverLaneEntities(
          { ...lane, entityWidthTiles: widthOverride ?? lane.entityWidthTiles },
          level
        )
      })
    }
    return RIVER_LANE_CONFIGS.flatMap(lane => createRiverLaneEntities(lane, level))
  }

  /** Process one RAF frame. Returns true if canvas needs a redraw. */
  tick(timestamp: number): boolean {
    if (this.state !== GameState.PLAYING) return false

    // Delta time
    const rawDelta = this.lastTimestamp === null ? 0 : timestamp - this.lastTimestamp
    this.lastTimestamp = timestamp
    const deltaMs = Math.min(rawDelta, DELTA_CAP_MS)
    this.elapsedSec += deltaMs / 1000

    // If level clear overlay is showing, count it down
    if (this.levelClearFrames > 0) {
      this.levelClearFrames--
      this.vehicles = this.vehicles.map(v => updateVehicle(v, deltaMs))
      this.riverEntities = this.riverEntities.map(e => updateRiverEntity(e, deltaMs))
      if (this.levelClearFrames === 0) {
        this.advanceLevel()
      }
      return true
    }

    // Skip collision and timer advance while death flash is playing
    if (this.frog.deathFlashFrames > 0) {
      this.frog = { ...this.frog, deathFlashFrames: this.frog.deathFlashFrames - 1 }
      if (this.frog.deathFlashFrames === 0) {
        this.saveBestScore()
        this.frog = makeFrog()
        this.timerSeconds = LEVEL_TIMER_SECONDS
        this.timerElapsedMs = 0
      }
      this.vehicles = this.vehicles.map(v => updateVehicle(v, deltaMs))
      this.riverEntities = this.riverEntities.map(e => updateRiverEntity(e, deltaMs))
      return true
    }

    // Update hop animation
    this.updateHopAnimation(deltaMs)

    // Update squash animation (post-landing)
    this.updateSquashAnimation(deltaMs)

    // Only process movement/collisions if hop is complete
    const hopDone = this.frog.hopProgress >= 1

    // Update timer
    this.updateTimer(deltaMs)

    // Apply pending input (hop movement) — only if no hop in progress
    if (hopDone) {
      this.applyMovement()
    }

    // Update vehicles
    this.vehicles = this.vehicles.map(v => updateVehicle(v, deltaMs))

    // Update river entities
    this.riverEntities = this.riverEntities.map(e => updateRiverEntity(e, deltaMs))

    // River riding and collision only when hop is done
    if (hopDone) {
      if (this.isInRiver()) {
        this.applyRiverRiding(deltaMs)
      }

      if (this.isOnRoad()) {
        for (const vehicle of this.vehicles) {
          const frogCol = Math.floor(this.frog.x / TILE_SIZE)
          if (checkVehicleCollision(frogCol, this.frog.row, vehicle)) {
            this.triggerDeath(DeathCause.VEHICLE)
            break
          }
        }
      }
    }

    return true
  }

  private updateHopAnimation(deltaMs: number): void {
    if (this.frog.hopProgress >= 1) return
    const newProgress = Math.min(1, this.frog.hopProgress + deltaMs / HOP_DURATION_MS)
    this.frog = { ...this.frog, hopProgress: newProgress }

    // When hop completes, trigger squash
    if (newProgress >= 1 && this.frog.hopProgress >= 1) {
      this.squashTimeMs = SQUASH_DURATION_MS
      this.frog = {
        ...this.frog,
        hopProgress: 1,
        hopScale: { x: 1.2, y: 0.8 },
      }
    }
  }

  private updateSquashAnimation(deltaMs: number): void {
    if (this.squashTimeMs <= 0) return
    this.squashTimeMs = Math.max(0, this.squashTimeMs - deltaMs)
    const t = this.squashTimeMs / SQUASH_DURATION_MS // 1→0
    // Interpolate squash scale back to 1
    const sx = 1 + (0.2 * t) // 1.2 → 1.0
    const sy = 1 - (0.2 * t) // 0.8 → 1.0
    this.frog = { ...this.frog, hopScale: { x: sx, y: sy } }
  }

  private updateTimer(deltaMs: number): void {
    this.timerElapsedMs += deltaMs
    const elapsed = Math.floor(this.timerElapsedMs / 1000)
    this.timerSeconds = Math.max(0, LEVEL_TIMER_SECONDS - elapsed)
    if (this.timerSeconds === 0) {
      this.triggerDeath(DeathCause.TIMER)
    }
  }

  private isInRiver(): boolean {
    return (RIVER_ROWS as readonly number[]).includes(this.frog.row)
  }

  private isOnRoad(): boolean {
    return (ROAD_ROWS as readonly number[]).includes(this.frog.row)
  }

  private applyRiverRiding(deltaMs: number): void {
    const frogCenterX = this.frog.x + TILE_SIZE / 2
    const ridingEntity = findRidingEntity(frogCenterX, this.frog.row, this.riverEntities)

    if (!ridingEntity) {
      this.triggerDeath(DeathCause.WATER)
      return
    }

    if (isOnSnake(frogCenterX, ridingEntity)) {
      this.triggerDeath(DeathCause.WATER)
      return
    }

    const dx = ridingEntity.speed * (deltaMs / 1000)
    const newX = this.frog.x + dx
    const newCol = Math.floor((newX + TILE_SIZE / 2) / TILE_SIZE)

    if (newX < 0 || newX > CANVAS_W - TILE_SIZE) {
      this.triggerDeath(DeathCause.WATER)
      return
    }

    this.frog = { ...this.frog, x: newX, col: newCol }
  }

  private applyMovement(): void {
    if (this.pendingDirection === Direction.NONE) return
    if (this.frog.deathFlashFrames > 0) {
      this.pendingDirection = Direction.NONE
      return
    }
    if (this.levelClearFrames > 0) {
      this.pendingDirection = Direction.NONE
      return
    }

    const dir = this.pendingDirection
    this.pendingDirection = Direction.NONE

    let newCol = this.frog.col
    let newRow = this.frog.row

    switch (dir) {
      case Direction.UP:    newRow -= 1; break
      case Direction.DOWN:  newRow += 1; break
      case Direction.LEFT:  newCol -= 1; break
      case Direction.RIGHT: newCol += 1; break
    }

    // Clamp to canvas edges
    newCol = Math.max(0, Math.min(COLS - 1, newCol))
    newRow = Math.max(0, Math.min(12, newRow))

    // Track furthest row advance for scoring
    const prevRow = this.frog.row
    if (newRow < prevRow) {
      this.score += SCORE_PER_ROW
    }

    const newX = newCol * TILE_SIZE
    this.hopStartRow = this.frog.row
    this.hopTargetRow = newRow

    // Fire hop sound
    this.audioCallbacks.onHop?.()

    this.frog = {
      ...this.frog,
      col: newCol,
      row: newRow,
      x: newX,
      facing: dir,
      hopProgress: 0, // start hop animation
      hopScale: { x: 1, y: 1 },
    }

    // Check home slot when frog hops to row 0
    if (newRow === 0) {
      this.checkHomeArrival()
    }
  }

  private checkHomeArrival(): void {
    const frogTileX = this.frog.col
    const slotIndex = checkHomeSlot(frogTileX, this.homes)

    if (slotIndex >= 0) {
      const timeBonus = this.timerSeconds * SCORE_TIME_BONUS_PER_SEC
      this.score += SCORE_HOME_BASE + timeBonus

      this.homes = this.homes.map((h, i) =>
        i === slotIndex ? { ...h, filled: true } : h
      )

      // Track daily attempt result
      if (this.homeAttemptResults[slotIndex] === 'unreached') {
        this.homeAttemptResults[slotIndex] = 'safe'
      }

      // Fire home fill sound
      this.audioCallbacks.onHomeFill?.()

      if (allHomesFilled(this.homes)) {
        // Fire level clear sound
        this.audioCallbacks.onLevelClear?.()
        this.levelClearFrames = this.LEVEL_CLEAR_FRAMES
      } else {
        this.frog = makeFrog()
        this.timerSeconds = LEVEL_TIMER_SECONDS
        this.timerElapsedMs = 0
      }
    } else {
      this.triggerDeath(DeathCause.WATER)
    }
  }

  private advanceLevel(): void {
    this.level++
    this.homes = createHomeSlots()
    this.frog = makeFrog()
    this.timerSeconds = LEVEL_TIMER_SECONDS
    this.timerElapsedMs = 0
    this.vehicles = this.buildVehicles(this.level)
    this.riverEntities = this.buildRiverEntities(this.level)
  }

  private triggerDeath(cause: DeathCause): void {
    // Track daily attempt result for the slot the frog was trying to reach
    if (this.mode === 'daily' && this.frog.row === 0) {
      const col = this.frog.col
      const slotIndex = this.homes.findIndex(h => h.tileX === col && !h.filled)
      if (slotIndex >= 0 && this.homeAttemptResults[slotIndex] === 'unreached') {
        this.homeAttemptResults[slotIndex] = 'died'
      }
    }

    // Fire audio based on cause
    if (cause === DeathCause.VEHICLE) {
      this.audioCallbacks.onSquishDeath?.()
    } else if (cause === DeathCause.WATER) {
      this.audioCallbacks.onSplashDeath?.()
    }

    this.lives -= 1

    if (this.lives <= 0) {
      this.state = GameState.GAME_OVER
      this.saveBestScore()
      return
    }

    this.frog = {
      ...this.frog,
      deathFlashFrames: DEATH_FLASH_FRAMES,
      alive: false,
    }
  }

  // ─── Rendering ──────────────────────────────────────────────────────────────

  render(ctx: CanvasRenderingContext2D): void {
    this.drawBackground(ctx)
    if (this.state === GameState.PLAYING) {
      this.drawRiverEntities(ctx)
      this.drawVehicles(ctx)
      this.drawFrog(ctx)
      this.drawHomeSlots(ctx)
      this.drawTimer(ctx)
      if (this.levelClearFrames > 0) {
        this.drawLevelClear(ctx)
      }
    }
  }

  private drawBackground(ctx: CanvasRenderingContext2D): void {
    // Home row (row 0) — deep green
    ctx.fillStyle = COLOR_HOME_ROW
    ctx.fillRect(0, 0, CANVAS_W, TILE_SIZE)

    // River rows (1-5) — turquoise base
    for (const row of RIVER_ROWS) {
      const y = row * TILE_SIZE
      ctx.fillStyle = COLOR_RIVER
      ctx.fillRect(0, y, CANVAS_W, TILE_SIZE)
    }

    // Ripple animation on river rows
    this.drawRipples(ctx)

    // Safe zones (rows 6, 12) — sage green
    ctx.fillStyle = COLOR_GRASS
    ctx.fillRect(0, 6 * TILE_SIZE, CANVAS_W, TILE_SIZE)
    ctx.fillStyle = COLOR_GRASS
    ctx.fillRect(0, 12 * TILE_SIZE, CANVAS_W, TILE_SIZE)

    // Road rows (7-11) — amber/terracotta
    for (const row of ROAD_ROWS) {
      const y = row * TILE_SIZE
      ctx.fillStyle = COLOR_ROAD
      ctx.fillRect(0, y, CANVAS_W, TILE_SIZE)
    }

    // Dashed white lane lines between road rows
    ctx.save()
    ctx.setLineDash([8, 8])
    ctx.strokeStyle = COLOR_LANE_LINE
    ctx.lineWidth = 2
    for (let i = 0; i < ROAD_ROWS.length - 1; i++) {
      const y = (ROAD_ROWS[i] + 1) * TILE_SIZE
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(CANVAS_W, y)
      ctx.stroke()
    }
    ctx.restore()
  }

  private drawRipples(ctx: CanvasRenderingContext2D): void {
    ctx.save()
    ctx.setLineDash([5, 3])
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'
    ctx.lineWidth = 1.5

    for (const row of RIVER_ROWS) {
      const rowY = row * TILE_SIZE
      for (let lineIdx = 0; lineIdx < 4; lineIdx++) {
        const yBase = rowY + TILE_SIZE * 0.2 + lineIdx * (TILE_SIZE * 0.18)
        ctx.beginPath()
        const step = 4
        for (let px = 0; px <= CANVAS_W; px += step) {
          const phaseOffset = this.elapsedSec * 0.5 + px * 0.02 + lineIdx * 0.8
          const waveY = yBase + Math.sin(phaseOffset) * 3
          if (px === 0) {
            ctx.moveTo(px, waveY)
          } else {
            ctx.lineTo(px, waveY)
          }
        }
        ctx.stroke()
      }
    }
    ctx.restore()
  }

  private drawHomeSlots(ctx: CanvasRenderingContext2D): void {
    for (const slot of this.homes) {
      const x = slot.tileX * TILE_SIZE
      const y = 0
      const cx = x + TILE_SIZE / 2
      const cy = y + TILE_SIZE / 2
      const r = TILE_SIZE * 0.4

      if (slot.filled) {
        ctx.fillStyle = '#40C8E0'
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = '#FFFFFF'
        ctx.lineWidth = 2
        ctx.stroke()
      } else {
        ctx.strokeStyle = '#5A8C3E'
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.stroke()
        ctx.fillStyle = COLOR_HOME_ROW
        ctx.fillRect(cx - 6, cy + r - 4, 12, 8)
      }
    }
  }

  private drawRiverEntities(ctx: CanvasRenderingContext2D): void {
    for (const entity of this.riverEntities) {
      const x = Math.round(entity.x)
      const y = entity.row * TILE_SIZE
      const w = entity.width
      const h = TILE_SIZE

      if (entity.type === 'log') {
        ctx.fillStyle = COLOR_LOG
        ctx.beginPath()
        ctx.roundRect(x + 2, y + 6, w - 4, h - 12, 8)
        ctx.fill()
        ctx.strokeStyle = 'rgba(0,0,0,0.2)'
        ctx.lineWidth = 1
        ctx.setLineDash([])
        const grainCount = Math.floor(w / TILE_SIZE) * 2
        for (let g = 1; g < grainCount; g++) {
          const gx = x + (w / grainCount) * g
          ctx.beginPath()
          ctx.moveTo(gx, y + 8)
          ctx.lineTo(gx, y + h - 8)
          ctx.stroke()
        }

        for (const snakeOffset of entity.snakeOffsets) {
          this.drawSnakeOnLog(ctx, x + snakeOffset, y)
        }
      } else {
        const cx = x + TILE_SIZE / 2
        const cy = y + TILE_SIZE / 2
        const r = TILE_SIZE * 0.38
        ctx.fillStyle = COLOR_LILY_PAD
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = COLOR_RIVER
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(cx - 6, cy + r)
        ctx.lineTo(cx + 6, cy + r)
        ctx.closePath()
        ctx.fill()
        ctx.strokeStyle = 'rgba(255,255,255,0.5)'
        ctx.lineWidth = 1.5
        ctx.setLineDash([])
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.stroke()
      }
    }
  }

  private drawSnakeOnLog(ctx: CanvasRenderingContext2D, tileX: number, rowY: number): void {
    const cx = tileX + TILE_SIZE / 2
    const cy = rowY + TILE_SIZE / 2

    ctx.strokeStyle = COLOR_SNAKE
    ctx.lineWidth = 5
    ctx.lineCap = 'round'
    ctx.setLineDash([])
    ctx.beginPath()
    ctx.moveTo(cx - 14, cy + 6)
    ctx.bezierCurveTo(cx - 8, cy - 8, cx + 8, cy + 8, cx + 14, cy - 6)
    ctx.stroke()

    ctx.fillStyle = COLOR_SNAKE_HEAD
    ctx.beginPath()
    ctx.arc(cx + 14, cy - 6, 4, 0, Math.PI * 2)
    ctx.fill()

    ctx.strokeStyle = '#FF0000'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(cx + 17, cy - 7)
    ctx.lineTo(cx + 21, cy - 5)
    ctx.moveTo(cx + 17, cy - 7)
    ctx.lineTo(cx + 21, cy - 9)
    ctx.stroke()
  }

  private drawVehicles(ctx: CanvasRenderingContext2D): void {
    for (const v of this.vehicles) {
      const x = Math.round(v.x)
      const y = v.row * TILE_SIZE
      const w = v.width
      const h = TILE_SIZE

      if (v.type === VehicleType.CAR) {
        ctx.fillStyle = COLOR_CAR_BODY
        ctx.beginPath()
        ctx.roundRect(x + 2, y + 4, w - 4, h - 8, 6)
        ctx.fill()
        ctx.fillStyle = COLOR_CAR_WINDOW
        ctx.fillRect(x + w * 0.3, y + 8, w * 0.4, h * 0.35)
        ctx.fillStyle = '#1A1A1A'
        ctx.beginPath(); ctx.arc(x + 10, y + h - 4, 4, 0, Math.PI * 2); ctx.fill()
        ctx.beginPath(); ctx.arc(x + w - 10, y + h - 4, 4, 0, Math.PI * 2); ctx.fill()
      } else {
        ctx.fillStyle = COLOR_TRUCK_BODY
        ctx.beginPath()
        ctx.roundRect(x + 2, y + 4, w - 4, h - 8, 6)
        ctx.fill()
        const cabW = TILE_SIZE * 0.7
        const windowX = v.speed > 0 ? x + w - cabW - 4 : x + 4
        ctx.fillStyle = COLOR_TRUCK_WINDOW
        ctx.fillRect(windowX, y + 8, cabW, h * 0.35)
        ctx.fillStyle = '#1A1A1A'
        ctx.beginPath(); ctx.arc(x + 10, y + h - 4, 4, 0, Math.PI * 2); ctx.fill()
        ctx.beginPath(); ctx.arc(x + w / 2, y + h - 4, 4, 0, Math.PI * 2); ctx.fill()
        ctx.beginPath(); ctx.arc(x + w - 10, y + h - 4, 4, 0, Math.PI * 2); ctx.fill()
      }
    }
  }

  private drawFrog(ctx: CanvasRenderingContext2D): void {
    const { row, facing, deathFlashFrames, hopProgress, hopScale } = this.frog
    const baseX = Math.round(this.frog.x) + TILE_SIZE / 2
    const baseY = row * TILE_SIZE + TILE_SIZE / 2

    // Compute arc Y offset from hop animation
    const hopOffset = hopProgress < 1
      ? -Math.sin(hopProgress * Math.PI) * (TILE_SIZE * 0.5)
      : 0

    // Also interpolate Y from source row to target row during hop
    const hopRowOffset = hopProgress < 1
      ? (this.hopTargetRow - this.hopStartRow) * TILE_SIZE * hopProgress
      - (this.hopTargetRow - this.hopStartRow) * TILE_SIZE
      : 0

    const cx = baseX
    const cy = baseY + hopOffset + hopRowOffset

    const r = TILE_SIZE * 0.38

    const isDead = deathFlashFrames > 0
    const flashOn = isDead && Math.floor(deathFlashFrames / 5) % 2 === 0

    ctx.save()
    ctx.translate(cx, cy)
    ctx.scale(hopScale.x, hopScale.y)

    ctx.fillStyle = flashOn ? COLOR_FROG_DEAD : COLOR_FROG_BODY
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = COLOR_FROG_BELLY
    ctx.fillRect(-r * 0.5, -r * 0.2, r, r * 0.4)

    ctx.fillStyle = flashOn ? '#FF8888' : '#3A6B22'
    const triSize = r * 0.45
    ctx.save()
    switch (facing) {
      case Direction.UP:    ctx.rotate(0); break
      case Direction.DOWN:  ctx.rotate(Math.PI); break
      case Direction.LEFT:  ctx.rotate(-Math.PI / 2); break
      case Direction.RIGHT: ctx.rotate(Math.PI / 2); break
    }
    ctx.beginPath()
    ctx.moveTo(0, -r)
    ctx.lineTo(-triSize / 2, -r + triSize)
    ctx.lineTo(triSize / 2, -r + triSize)
    ctx.closePath()
    ctx.fill()
    ctx.restore()

    ctx.fillStyle = COLOR_FROG_EYE
    const eyeOffset = r * 0.35
    const eyeR = r * 0.15
    let eyeX1 = -eyeOffset, eyeY1 = -r * 0.3
    let eyeX2 = eyeOffset, eyeY2 = -r * 0.3
    if (facing === Direction.LEFT || facing === Direction.RIGHT) {
      eyeX1 = facing === Direction.RIGHT ? r * 0.3 : -r * 0.3
      eyeY1 = -eyeOffset
      eyeX2 = facing === Direction.RIGHT ? r * 0.3 : -r * 0.3
      eyeY2 = eyeOffset
    }
    ctx.beginPath(); ctx.arc(eyeX1, eyeY1, eyeR, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.arc(eyeX2, eyeY2, eyeR, 0, Math.PI * 2); ctx.fill()

    ctx.fillStyle = '#FFFFFF'
    ctx.beginPath(); ctx.arc(eyeX1 + eyeR * 0.3, eyeY1 - eyeR * 0.3, eyeR * 0.4, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.arc(eyeX2 + eyeR * 0.3, eyeY2 - eyeR * 0.3, eyeR * 0.4, 0, Math.PI * 2); ctx.fill()

    ctx.restore()
  }

  private drawTimer(ctx: CanvasRenderingContext2D): void {
    const urgent = this.timerSeconds <= 5
    const flashVisible = urgent ? Math.floor(this.elapsedSec * 4) % 2 === 0 : true

    if (!flashVisible) return

    ctx.save()
    ctx.font = 'bold 28px monospace'
    ctx.textAlign = 'center'
    ctx.fillStyle = urgent ? COLOR_TIMER_URGENT : COLOR_TIMER_NORMAL

    const timerText = String(this.timerSeconds).padStart(2, '0')
    ctx.shadowColor = 'rgba(0,0,0,0.8)'
    ctx.shadowBlur = 6
    ctx.fillText(timerText, CANVAS_W / 2, TILE_SIZE * 0.75)
    ctx.restore()
  }

  private drawLevelClear(ctx: CanvasRenderingContext2D): void {
    const alpha = Math.min(1, this.levelClearFrames / 30)
    ctx.save()
    ctx.globalAlpha = alpha * 0.85
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)
    ctx.globalAlpha = alpha

    ctx.font = 'bold 36px monospace'
    ctx.textAlign = 'center'
    ctx.fillStyle = '#FFD700'
    ctx.shadowColor = '#FF8800'
    ctx.shadowBlur = 16
    ctx.fillText('Level Clear!', CANVAS_W / 2, CANVAS_H / 2 - 18)

    ctx.font = '20px monospace'
    ctx.fillStyle = '#FFFFFF'
    ctx.shadowBlur = 0
    ctx.fillText(`Level ${this.level + 1}`, CANVAS_W / 2, CANVAS_H / 2 + 24)
    ctx.restore()
  }
}
