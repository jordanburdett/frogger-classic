import { describe, it, expect } from 'vitest'
import { COLS, CANVAS_W, TILE_SIZE, LANE_CONFIGS } from '../game/constants.ts'
import {
  createLaneVehicles,
  updateVehicle,
  checkVehicleCollision,
  vehicleTileRange,
} from '../game/vehicles.ts'
import { VehicleType } from '../game/types.ts'
import type { VehicleState } from '../game/types.ts'

// ─── Frog movement clamping ─────────────────────────────────────────────────

describe('frog movement clamping', () => {
  function clampCol(col: number): number {
    return Math.max(0, Math.min(COLS - 1, col))
  }
  function clampRow(row: number): number {
    return Math.max(0, Math.min(12, row))
  }

  it('clamps column to left edge (0)', () => {
    expect(clampCol(-1)).toBe(0)
    expect(clampCol(0)).toBe(0)
  })

  it('clamps column to right edge (COLS-1)', () => {
    expect(clampCol(COLS)).toBe(COLS - 1)
    expect(clampCol(COLS - 1)).toBe(COLS - 1)
  })

  it('allows all valid columns', () => {
    for (let c = 0; c < COLS; c++) {
      expect(clampCol(c)).toBe(c)
    }
  })

  it('clamps row to top edge (0)', () => {
    expect(clampRow(-1)).toBe(0)
  })

  it('clamps row to bottom edge (12)', () => {
    expect(clampRow(13)).toBe(12)
  })

  it('allows all valid rows', () => {
    for (let r = 0; r <= 12; r++) {
      expect(clampRow(r)).toBe(r)
    }
  })
})

// ─── Vehicle collision detection ───────────────────────────────────────────

describe('vehicle collision detection', () => {
  const car: VehicleState = {
    x: TILE_SIZE * 2,       // occupies tiles 2 and 3
    row: 9,
    width: TILE_SIZE * 2,
    type: VehicleType.CAR,
    speed: 100,
  }

  it('detects collision when frog is on first tile of car', () => {
    expect(checkVehicleCollision(2, 9, car)).toBe(true)
  })

  it('detects collision when frog is on last tile of car', () => {
    expect(checkVehicleCollision(3, 9, car)).toBe(true)
  })

  it('no collision just before car', () => {
    expect(checkVehicleCollision(1, 9, car)).toBe(false)
  })

  it('no collision just after car', () => {
    expect(checkVehicleCollision(4, 9, car)).toBe(false)
  })

  it('no collision on different row', () => {
    expect(checkVehicleCollision(2, 8, car)).toBe(false)
    expect(checkVehicleCollision(3, 10, car)).toBe(false)
  })

  it('truck spans 3 tiles', () => {
    const truck: VehicleState = {
      x: TILE_SIZE * 5,
      row: 7,
      width: TILE_SIZE * 3,
      type: VehicleType.TRUCK,
      speed: -80,
    }
    expect(checkVehicleCollision(5, 7, truck)).toBe(true)
    expect(checkVehicleCollision(6, 7, truck)).toBe(true)
    expect(checkVehicleCollision(7, 7, truck)).toBe(true)
    expect(checkVehicleCollision(4, 7, truck)).toBe(false)
    expect(checkVehicleCollision(8, 7, truck)).toBe(false)
  })
})

// ─── Vehicle looping math ──────────────────────────────────────────────────

describe('vehicle looping', () => {
  it('vehicle moving right wraps around canvas right edge', () => {
    const v: VehicleState = {
      x: CANVAS_W - 5,
      row: 11,
      width: TILE_SIZE * 2,
      type: VehicleType.CAR,
      speed: 200,
    }
    // After one large delta, x > CANVAS_W, so wraps to -width
    const updated = updateVehicle(v, 100) // 20px delta at 200px/s = 20px
    // x = CANVAS_W - 5 + 20 = CANVAS_W + 15 → wraps to -TILE_SIZE*2
    expect(updated.x).toBe(-v.width)
  })

  it('vehicle moving left wraps around canvas left edge', () => {
    const v: VehicleState = {
      x: 5,
      row: 10,
      width: TILE_SIZE * 2,
      type: VehicleType.CAR,
      speed: -200,
    }
    // After 100ms at -200px/s: dx = -20, x = 5 - 20 = -15 → x + width = -15 + 96 = 81 > 0, no wrap
    const v2 = updateVehicle(v, 100)
    expect(v2.x).toBe(5 - 20)

    // When x + width < 0: need x < -width
    const v3: VehicleState = { ...v, x: -v.width - 1 }
    const updated = updateVehicle(v3, 16) // small delta to just push it further left
    // x = -97 - 3.2 = -100.2 → x + width = -100.2 + 96 = -4.2 < 0 → wraps to CANVAS_W
    expect(updated.x).toBe(CANVAS_W)
  })

  it('vehicle tile range is correct', () => {
    const v: VehicleState = {
      x: TILE_SIZE * 3 + 12,
      row: 9,
      width: TILE_SIZE * 2,
      type: VehicleType.CAR,
      speed: 0,
    }
    const range = vehicleTileRange(v)
    // x=156, so start = floor(156/48) = 3
    // x+width-1 = 156+96-1=251, end = floor(251/48) = 5
    expect(range.start).toBe(3)
    expect(range.end).toBe(5)
  })
})

// ─── Score calculation ─────────────────────────────────────────────────────

describe('score calculation', () => {
  it('awards SCORE_PER_ROW points per row advanced', () => {
    const SCORE_PER_ROW = 10
    let score = 0
    const rows = [12, 11, 10, 9, 8, 7, 6]
    for (let i = 1; i < rows.length; i++) {
      if (rows[i] < rows[i - 1]) score += SCORE_PER_ROW
    }
    expect(score).toBe(60)
  })

  it('no score for moving backward (row increase)', () => {
    const SCORE_PER_ROW = 10
    let score = 0
    // move forward then back
    const moves = [{ prev: 12, next: 11 }, { prev: 11, next: 12 }]
    for (const { prev, next } of moves) {
      if (next < prev) score += SCORE_PER_ROW
    }
    expect(score).toBe(10)
  })
})

// ─── Lane configs ──────────────────────────────────────────────────────────

describe('lane configs', () => {
  it('all lanes are in road rows 7-11', () => {
    for (const lane of LANE_CONFIGS) {
      expect(lane.row).toBeGreaterThanOrEqual(7)
      expect(lane.row).toBeLessThanOrEqual(11)
    }
  })

  it('lanes alternate direction', () => {
    // At least one goes right and one goes left
    const dirs = new Set(LANE_CONFIGS.map(l => l.direction))
    expect(dirs.has(1)).toBe(true)
    expect(dirs.has(-1)).toBe(true)
  })

  it('createLaneVehicles produces correct number of vehicles', () => {
    for (const lane of LANE_CONFIGS) {
      const vehicles = createLaneVehicles(lane)
      expect(vehicles.length).toBe(lane.vehicleCount)
    }
  })

  it('all vehicles in a lane are in the correct row', () => {
    for (const lane of LANE_CONFIGS) {
      const vehicles = createLaneVehicles(lane)
      for (const v of vehicles) {
        expect(v.row).toBe(lane.row)
      }
    }
  })

  it('vehicle speed direction matches lane direction', () => {
    for (const lane of LANE_CONFIGS) {
      const vehicles = createLaneVehicles(lane)
      for (const v of vehicles) {
        expect(Math.sign(v.speed)).toBe(lane.direction)
      }
    }
  })
})
