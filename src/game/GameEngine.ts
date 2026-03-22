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
  LANE_CONFIGS,
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
  createAllRiverEntities,
  updateRiverEntity,
  findRidingEntity,
  isOnSnake,
  createHomeSlots,
  checkHomeSlot,
  allHomesFilled,
} from './river.ts'

function makeFrog(): FrogState {
  return {
    col: FROG_START_COL,
    row: FROG_START_ROW,
    x: FROG_START_COL * TILE_SIZE,
    facing: Direction.UP,
    deathFlashFrames: 0,
    alive: true,
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
  private boundKeyHandler: (e: KeyboardEvent) => void
  // Track time for ripple animation
  private elapsedSec: number = 0

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

  startGame(mode: GameMode): void {
    this.mode = mode
    this.lives = INITIAL_LIVES
    this.score = 0
    this.level = 1
    this.frog = makeFrog()
    this.vehicles = LANE_CONFIGS.flatMap(lane => createLaneVehicles(lane))
    this.riverEntities = createAllRiverEntities(this.level)
    this.homes = createHomeSlots()
    this.timerSeconds = LEVEL_TIMER_SECONDS
    this.timerElapsedMs = 0
    this.levelClearFrames = 0
    this.lastTimestamp = null
    this.elapsedSec = 0
    this.state = GameState.PLAYING
  }

  restartGame(): void {
    if (this.mode) this.startGame(this.mode)
  }

  goToMenu(): void {
    this.state = GameState.MODE_SELECT
    this.pendingDirection = Direction.NONE
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
      // Still update entities during the overlay so scene stays alive
      this.vehicles = this.vehicles.map(v => updateVehicle(v, deltaMs))
      this.riverEntities = this.riverEntities.map(e => updateRiverEntity(e, deltaMs))
      if (this.levelClearFrames === 0) {
        this.advanceLevel()
      }
      return true
    }

    // Update timer
    this.updateTimer(deltaMs)

    // Apply pending input (hop movement)
    this.applyMovement()

    // Update vehicles
    this.vehicles = this.vehicles.map(v => updateVehicle(v, deltaMs))

    // Update river entities
    this.riverEntities = this.riverEntities.map(e => updateRiverEntity(e, deltaMs))

    // Skip collision when flashing
    if (this.frog.deathFlashFrames > 0) {
      this.frog = { ...this.frog, deathFlashFrames: this.frog.deathFlashFrames - 1 }
      if (this.frog.deathFlashFrames === 0) {
        this.saveBestScore()
        this.frog = makeFrog()
        this.timerSeconds = LEVEL_TIMER_SECONDS
        this.timerElapsedMs = 0
      }
      return true
    }

    // River riding (rows 1-5)
    if (this.isInRiver()) {
      this.applyRiverRiding(deltaMs)
    }

    // Vehicle collision (road rows 7-11)
    if (this.isOnRoad()) {
      for (const vehicle of this.vehicles) {
        // Use frog's current tile col for road collision
        const frogCol = Math.floor(this.frog.x / TILE_SIZE)
        if (checkVehicleCollision(frogCol, this.frog.row, vehicle)) {
          this.triggerDeath()
          break
        }
      }
    }

    return true
  }

  private updateTimer(deltaMs: number): void {
    this.timerElapsedMs += deltaMs
    const elapsed = Math.floor(this.timerElapsedMs / 1000)
    this.timerSeconds = Math.max(0, LEVEL_TIMER_SECONDS - elapsed)
    if (this.timerSeconds === 0) {
      this.triggerDeath()
      // Note: timerSeconds resets when respawn completes (death flash countdown)
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
      // Not on any log/pad → water death
      this.triggerDeath()
      return
    }

    // Check for snake on the entity
    if (isOnSnake(frogCenterX, ridingEntity)) {
      this.triggerDeath()
      return
    }

    // Move frog with the log/pad
    const dx = ridingEntity.speed * (deltaMs / 1000)
    const newX = this.frog.x + dx
    const newCol = Math.floor((newX + TILE_SIZE / 2) / TILE_SIZE)

    // If frog rides off screen edge → water death
    if (newX < 0 || newX > CANVAS_W - TILE_SIZE) {
      this.triggerDeath()
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
    this.frog = { ...this.frog, col: newCol, row: newRow, x: newX, facing: dir }

    // Check home slot when frog hops to row 0
    if (newRow === 0) {
      this.checkHomeArrival()
    }
  }

  private checkHomeArrival(): void {
    const frogTileX = this.frog.col
    const slotIndex = checkHomeSlot(frogTileX, this.homes)

    if (slotIndex >= 0) {
      // Valid home slot reached
      const timeBonus = this.timerSeconds * SCORE_TIME_BONUS_PER_SEC
      this.score += SCORE_HOME_BASE + timeBonus

      // Mark home filled
      this.homes = this.homes.map((h, i) =>
        i === slotIndex ? { ...h, filled: true } : h
      )

      // Check level complete
      if (allHomesFilled(this.homes)) {
        this.levelClearFrames = this.LEVEL_CLEAR_FRAMES
      } else {
        // Respawn frog, reset timer
        this.frog = makeFrog()
        this.timerSeconds = LEVEL_TIMER_SECONDS
        this.timerElapsedMs = 0
      }
    } else {
      // Wrong tile at row 0 (no home there, or already filled) → water death
      this.triggerDeath()
    }
  }

  private advanceLevel(): void {
    this.level++
    this.homes = createHomeSlots()
    this.frog = makeFrog()
    this.timerSeconds = LEVEL_TIMER_SECONDS
    this.timerElapsedMs = 0
    // Rebuild vehicles with new level speed (via lane configs scaled elsewhere)
    // For vehicles: scale current speeds
    this.vehicles = this.vehicles.map(v => ({
      ...v,
      speed: v.speed * 1.1,
    }))
    // Rebuild river entities at new level (handles width shrinkage + new speeds)
    this.riverEntities = createAllRiverEntities(this.level)
  }

  private triggerDeath(): void {
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

    // Median (row 6) already drawn above as COLOR_GRASS/COLOR_MEDIAN
  }

  private drawRipples(ctx: CanvasRenderingContext2D): void {
    ctx.save()
    ctx.setLineDash([5, 3])
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'
    ctx.lineWidth = 1.5

    for (const row of RIVER_ROWS) {
      const rowY = row * TILE_SIZE
      // 4 ripple lines per row
      for (let lineIdx = 0; lineIdx < 4; lineIdx++) {
        const yBase = rowY + TILE_SIZE * 0.2 + lineIdx * (TILE_SIZE * 0.18)
        ctx.beginPath()
        // Horizontal sine wave
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
    // Draw lily-pad style home markers on row 0
    for (const slot of this.homes) {
      const x = slot.tileX * TILE_SIZE
      const y = 0
      const cx = x + TILE_SIZE / 2
      const cy = y + TILE_SIZE / 2
      const r = TILE_SIZE * 0.4

      if (slot.filled) {
        // Filled: bright frog color
        ctx.fillStyle = '#40C8E0'
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = '#FFFFFF'
        ctx.lineWidth = 2
        ctx.stroke()
      } else {
        // Empty: outline lily pad
        ctx.strokeStyle = '#5A8C3E'
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.stroke()
        // Slot notch (gap at bottom)
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
        // Log: brown rounded rect
        ctx.fillStyle = COLOR_LOG
        ctx.beginPath()
        ctx.roundRect(x + 2, y + 6, w - 4, h - 12, 8)
        ctx.fill()
        // Wood grain lines
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

        // Draw snakes
        for (const snakeOffset of entity.snakeOffsets) {
          this.drawSnakeOnLog(ctx, x + snakeOffset, y)
        }
      } else {
        // Lily pad: green circle
        const cx = x + TILE_SIZE / 2
        const cy = y + TILE_SIZE / 2
        const r = TILE_SIZE * 0.38
        ctx.fillStyle = COLOR_LILY_PAD
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.fill()
        // Lily pad notch
        ctx.fillStyle = COLOR_RIVER
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(cx - 6, cy + r)
        ctx.lineTo(cx + 6, cy + r)
        ctx.closePath()
        ctx.fill()
        // White outline
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

    // Snake body: S-curve
    ctx.strokeStyle = COLOR_SNAKE
    ctx.lineWidth = 5
    ctx.lineCap = 'round'
    ctx.setLineDash([])
    ctx.beginPath()
    ctx.moveTo(cx - 14, cy + 6)
    ctx.bezierCurveTo(cx - 8, cy - 8, cx + 8, cy + 8, cx + 14, cy - 6)
    ctx.stroke()

    // Snake head: small orange circle
    ctx.fillStyle = COLOR_SNAKE_HEAD
    ctx.beginPath()
    ctx.arc(cx + 14, cy - 6, 4, 0, Math.PI * 2)
    ctx.fill()

    // Forked tongue
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
    const { row, facing, deathFlashFrames } = this.frog
    const cx = Math.round(this.frog.x) + TILE_SIZE / 2
    const cy = row * TILE_SIZE + TILE_SIZE / 2
    const r = TILE_SIZE * 0.38

    const isDead = deathFlashFrames > 0
    const flashOn = isDead && Math.floor(deathFlashFrames / 5) % 2 === 0

    ctx.fillStyle = flashOn ? COLOR_FROG_DEAD : COLOR_FROG_BODY
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = COLOR_FROG_BELLY
    ctx.fillRect(cx - r * 0.5, cy - r * 0.2, r, r * 0.4)

    ctx.fillStyle = flashOn ? '#FF8888' : '#3A6B22'
    const triSize = r * 0.45
    ctx.save()
    ctx.translate(cx, cy)
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
    let eyeX1 = cx - eyeOffset, eyeY1 = cy - r * 0.3
    let eyeX2 = cx + eyeOffset, eyeY2 = cy - r * 0.3
    if (facing === Direction.LEFT || facing === Direction.RIGHT) {
      eyeX1 = facing === Direction.RIGHT ? cx + r * 0.3 : cx - r * 0.3
      eyeY1 = cy - eyeOffset
      eyeX2 = facing === Direction.RIGHT ? cx + r * 0.3 : cx - r * 0.3
      eyeY2 = cy + eyeOffset
    }
    ctx.beginPath(); ctx.arc(eyeX1, eyeY1, eyeR, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.arc(eyeX2, eyeY2, eyeR, 0, Math.PI * 2); ctx.fill()

    ctx.fillStyle = '#FFFFFF'
    ctx.beginPath(); ctx.arc(eyeX1 + eyeR * 0.3, eyeY1 - eyeR * 0.3, eyeR * 0.4, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.arc(eyeX2 + eyeR * 0.3, eyeY2 - eyeR * 0.3, eyeR * 0.4, 0, Math.PI * 2); ctx.fill()
  }

  private drawTimer(ctx: CanvasRenderingContext2D): void {
    const urgent = this.timerSeconds <= 5
    const flashVisible = urgent ? Math.floor(this.elapsedSec * 4) % 2 === 0 : true

    if (!flashVisible) return

    ctx.save()
    ctx.font = 'bold 28px monospace'
    ctx.textAlign = 'center'
    ctx.fillStyle = urgent ? COLOR_TIMER_URGENT : COLOR_TIMER_NORMAL

    // Draw at top-center of the game canvas area (below home row)
    const timerText = String(this.timerSeconds).padStart(2, '0')
    // Draw with a shadow for readability
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
