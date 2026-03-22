import { Direction, GameState } from './types.ts'
import type { FrogState, VehicleState, GameMode } from './types.ts'
import {
  COLS,
  FROG_START_COL,
  FROG_START_ROW,
  INITIAL_LIVES,
  DEATH_FLASH_FRAMES,
  SCORE_PER_ROW,
  DELTA_CAP_MS,
  LANE_CONFIGS,
  ROAD_ROWS,
  CANVAS_W,
  CANVAS_H,
  TILE_SIZE,
  COLOR_ROAD,
  COLOR_GRASS,
  COLOR_MEDIAN,
  COLOR_LANE_LINE,
  COLOR_FROG_BODY,
  COLOR_FROG_BELLY,
  COLOR_FROG_EYE,
  COLOR_FROG_DEAD,
  COLOR_CAR_BODY,
  COLOR_CAR_WINDOW,
  COLOR_TRUCK_BODY,
  COLOR_TRUCK_WINDOW,
  COLOR_HUD_BG,
  COLOR_HUD_TEXT,
  COLOR_SCORE_TEXT,
} from './constants.ts'
import { VehicleType } from './types.ts'
import { createLaneVehicles, updateVehicle, checkVehicleCollision } from './vehicles.ts'

function makeFrog(): FrogState {
  return {
    col: FROG_START_COL,
    row: FROG_START_ROW,
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

  lives: number = INITIAL_LIVES
  score: number = 0
  bestScore: number = 0
  level: number = 1

  private pendingDirection: Direction = Direction.NONE
  private lastTimestamp: number | null = null
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

  startGame(mode: GameMode): void {
    this.mode = mode
    this.lives = INITIAL_LIVES
    this.score = 0
    this.level = 1
    this.frog = makeFrog()
    this.vehicles = LANE_CONFIGS.flatMap(lane => createLaneVehicles(lane))
    this.lastTimestamp = null
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

  /** Process one RAF frame. Returns true if canvas needs a redraw (always true here). */
  tick(timestamp: number): boolean {
    if (this.state !== GameState.PLAYING) return false

    // Delta time
    const rawDelta = this.lastTimestamp === null ? 0 : timestamp - this.lastTimestamp
    this.lastTimestamp = timestamp
    const deltaMs = Math.min(rawDelta, DELTA_CAP_MS)

    // Apply pending input
    this.applyMovement()

    // Update vehicles
    this.vehicles = this.vehicles.map(v => updateVehicle(v, deltaMs))

    // Collision detection
    if (this.frog.deathFlashFrames === 0) {
      for (const vehicle of this.vehicles) {
        if (checkVehicleCollision(this.frog.col, this.frog.row, vehicle)) {
          this.triggerDeath()
          break
        }
      }
    } else {
      // Count down flash
      this.frog = { ...this.frog, deathFlashFrames: this.frog.deathFlashFrames - 1 }
      if (this.frog.deathFlashFrames === 0) {
        // Respawn or game over already handled in triggerDeath
      }
    }

    return true
  }

  private applyMovement(): void {
    if (this.pendingDirection === Direction.NONE) return
    if (this.frog.deathFlashFrames > 0) {
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

    // Track furthest row advance for scoring (rows decrease = moving toward top)
    const prevRow = this.frog.row
    if (newRow < prevRow) {
      this.score += SCORE_PER_ROW
    }

    this.frog = { ...this.frog, col: newCol, row: newRow, facing: dir }
  }

  private triggerDeath(): void {
    this.lives -= 1
    this.saveBestScore()

    if (this.lives <= 0) {
      this.state = GameState.GAME_OVER
      this.saveBestScore()
      return
    }

    // Flash and respawn
    this.frog = {
      ...this.frog,
      deathFlashFrames: DEATH_FLASH_FRAMES,
      alive: false,
    }

    // Schedule respawn after flash (we do it immediately by resetting on flash end)
    // Actually we handle respawn in tick() when deathFlashFrames reaches 0
    // but we need to set it up: reset frog position after flash
    // We use a simple timer via the flash frames counter
    // The actual position reset happens when deathFlashFrames hits 0
    const resetAfterFlash = () => {
      this.frog = makeFrog()
    }
    // We set a timeout to reset after the frames elapse
    // At 60fps, 30 frames = 500ms
    setTimeout(resetAfterFlash, (DEATH_FLASH_FRAMES / 60) * 1000 + 50)
  }

  // ─── Rendering ──────────────────────────────────────────────────────────────

  render(ctx: CanvasRenderingContext2D): void {
    this.drawBackground(ctx)
    if (this.state === GameState.PLAYING) {
      this.drawVehicles(ctx)
      this.drawFrog(ctx)
    }
  }

  private drawBackground(ctx: CanvasRenderingContext2D): void {
    // Fill entire canvas with grass color as default
    ctx.fillStyle = COLOR_GRASS
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

    // Draw road rows
    for (const row of ROAD_ROWS) {
      const y = row * TILE_SIZE
      ctx.fillStyle = COLOR_ROAD
      ctx.fillRect(0, y, CANVAS_W, TILE_SIZE)
    }

    // Draw dashed lane lines between road rows
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

    // Median (row 6)
    ctx.fillStyle = COLOR_MEDIAN
    ctx.fillRect(0, 6 * TILE_SIZE, CANVAS_W, TILE_SIZE)

    // Row labels (subtle) — optional visual cue, skip for cleanliness

    // Draw grid lines for debugging — omit in production
  }

  private drawVehicles(ctx: CanvasRenderingContext2D): void {
    for (const v of this.vehicles) {
      const x = Math.round(v.x)
      const y = v.row * TILE_SIZE
      const w = v.width
      const h = TILE_SIZE

      if (v.type === VehicleType.CAR) {
        // Car body
        ctx.fillStyle = COLOR_CAR_BODY
        ctx.beginPath()
        ctx.roundRect(x + 2, y + 4, w - 4, h - 8, 6)
        ctx.fill()
        // Windshield
        ctx.fillStyle = COLOR_CAR_WINDOW
        ctx.fillRect(x + w * 0.3, y + 8, w * 0.4, h * 0.35)
        // Wheels
        ctx.fillStyle = '#1A1A1A'
        ctx.beginPath(); ctx.arc(x + 10, y + h - 4, 4, 0, Math.PI * 2); ctx.fill()
        ctx.beginPath(); ctx.arc(x + w - 10, y + h - 4, 4, 0, Math.PI * 2); ctx.fill()
      } else {
        // Truck body
        ctx.fillStyle = COLOR_TRUCK_BODY
        ctx.beginPath()
        ctx.roundRect(x + 2, y + 4, w - 4, h - 8, 6)
        ctx.fill()
        // Cab window
        const cabW = TILE_SIZE * 0.7
        const windowX = v.speed > 0 ? x + w - cabW - 4 : x + 4
        ctx.fillStyle = COLOR_TRUCK_WINDOW
        ctx.fillRect(windowX, y + 8, cabW, h * 0.35)
        // Wheels
        ctx.fillStyle = '#1A1A1A'
        ctx.beginPath(); ctx.arc(x + 10, y + h - 4, 4, 0, Math.PI * 2); ctx.fill()
        ctx.beginPath(); ctx.arc(x + w / 2, y + h - 4, 4, 0, Math.PI * 2); ctx.fill()
        ctx.beginPath(); ctx.arc(x + w - 10, y + h - 4, 4, 0, Math.PI * 2); ctx.fill()
      }
    }
  }

  private drawFrog(ctx: CanvasRenderingContext2D): void {
    const { col, row, facing, deathFlashFrames } = this.frog
    const cx = col * TILE_SIZE + TILE_SIZE / 2
    const cy = row * TILE_SIZE + TILE_SIZE / 2
    const r = TILE_SIZE * 0.38

    // Flash red alternating every 5 frames
    const isDead = deathFlashFrames > 0
    const flashOn = isDead && Math.floor(deathFlashFrames / 5) % 2 === 0

    // Body
    ctx.fillStyle = flashOn ? COLOR_FROG_DEAD : COLOR_FROG_BODY
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fill()

    // Belly stripe (white horizontal band)
    ctx.fillStyle = COLOR_FROG_BELLY
    ctx.fillRect(cx - r * 0.5, cy - r * 0.2, r, r * 0.4)

    // Direction indicator — draw a small triangle showing facing direction
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

    // Eyes
    ctx.fillStyle = COLOR_FROG_EYE
    const eyeOffset = r * 0.35
    const eyeR = r * 0.15
    // Position eyes relative to facing direction
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

    // White eye highlight
    ctx.fillStyle = '#FFFFFF'
    ctx.beginPath(); ctx.arc(eyeX1 + eyeR * 0.3, eyeY1 - eyeR * 0.3, eyeR * 0.4, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.arc(eyeX2 + eyeR * 0.3, eyeY2 - eyeR * 0.3, eyeR * 0.4, 0, Math.PI * 2); ctx.fill()
  }

  renderHUD(ctx: CanvasRenderingContext2D): void {
    // Top HUD bar: score + level
    ctx.fillStyle = COLOR_HUD_BG
    ctx.fillRect(0, 0, CANVAS_W, 0) // The HUD is drawn in the React overlay, not canvas
    // Score in top-center area of canvas
    ctx.fillStyle = COLOR_SCORE_TEXT
    ctx.font = 'bold 18px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(`SCORE: ${this.score}`, CANVAS_W / 2, 22)

    // Level top-right
    ctx.fillStyle = COLOR_HUD_TEXT
    ctx.textAlign = 'right'
    ctx.fillText(`LVL ${this.level}`, CANVAS_W - 8, 22)

    // Lives as small frog icons bottom-left
    ctx.textAlign = 'left'
    ctx.font = '18px monospace'
    for (let i = 0; i < this.lives; i++) {
      this.drawMiniLife(ctx, 8 + i * 28, CANVAS_H - 24)
    }

    ctx.textAlign = 'left' // reset
  }

  private drawMiniLife(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.fillStyle = COLOR_FROG_BODY
    ctx.beginPath()
    ctx.arc(x + 8, y + 8, 8, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = COLOR_FROG_EYE
    ctx.beginPath(); ctx.arc(x + 5, y + 6, 2, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.arc(x + 11, y + 6, 2, 0, Math.PI * 2); ctx.fill()
  }
}
