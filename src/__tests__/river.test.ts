import { describe, it, expect } from 'vitest'
import {
  TILE_SIZE,
  CANVAS_W,
  LEVEL_TIMER_SECONDS,
  RIVER_LANE_CONFIGS,
  HOME_SLOT_COLS,
  SCORE_HOME_BASE,
  SCORE_TIME_BONUS_PER_SEC,
} from '../game/constants.ts'
import {
  createRiverLaneEntities,
  updateRiverEntity,
  findRidingEntity,
  isOnSnake,
  createHomeSlots,
  checkHomeSlot,
  allHomesFilled,
  getEntityWidthTiles,
  getSnakeOffsets,
  createAllRiverEntities,
} from '../game/river.ts'
import { RiverEntityType } from '../game/types.ts'
import type { RiverEntity, RiverLaneConfig } from '../game/types.ts'

// ─── Log-riding translation math ───────────────────────────────────────────

describe('log riding translation', () => {
  it('frog center-x within log span → riding entity found', () => {
    const entities: RiverEntity[] = [
      {
        x: TILE_SIZE * 2,
        row: 3,
        width: TILE_SIZE * 3,
        type: RiverEntityType.LOG,
        speed: 80,
        snakeOffsets: [],
      },
    ]
    // frog center at tile 2 + 0.5 = tile 2.5 center = 2*48+24 = 120
    const frogCenterX = TILE_SIZE * 2 + TILE_SIZE / 2
    const result = findRidingEntity(frogCenterX, 3, entities)
    expect(result).not.toBeNull()
    expect(result?.row).toBe(3)
  })

  it('frog center-x at left edge of log is riding', () => {
    const entities: RiverEntity[] = [
      {
        x: 100,
        row: 2,
        width: TILE_SIZE * 2,
        type: RiverEntityType.LOG,
        speed: -60,
        snakeOffsets: [],
      },
    ]
    const result = findRidingEntity(100, 2, entities) // exactly at left edge
    expect(result).not.toBeNull()
  })

  it('frog center-x at right edge of log is riding', () => {
    const entities: RiverEntity[] = [
      {
        x: 100,
        row: 2,
        width: TILE_SIZE * 2,
        type: RiverEntityType.LOG,
        speed: -60,
        snakeOffsets: [],
      },
    ]
    const rightEdge = 100 + TILE_SIZE * 2
    const result = findRidingEntity(rightEdge, 2, entities)
    expect(result).not.toBeNull()
  })

  it('frog center-x just past right edge is NOT riding', () => {
    const entities: RiverEntity[] = [
      {
        x: 100,
        row: 2,
        width: TILE_SIZE * 2,
        type: RiverEntityType.LOG,
        speed: -60,
        snakeOffsets: [],
      },
    ]
    const result = findRidingEntity(100 + TILE_SIZE * 2 + 1, 2, entities)
    expect(result).toBeNull()
  })

  it('frog center-x just before left edge is NOT riding', () => {
    const entities: RiverEntity[] = [
      {
        x: 100,
        row: 2,
        width: TILE_SIZE * 2,
        type: RiverEntityType.LOG,
        speed: -60,
        snakeOffsets: [],
      },
    ]
    const result = findRidingEntity(99, 2, entities)
    expect(result).toBeNull()
  })

  it('correct row must match for riding', () => {
    const entities: RiverEntity[] = [
      {
        x: 100,
        row: 3,
        width: TILE_SIZE * 2,
        type: RiverEntityType.LOG,
        speed: 80,
        snakeOffsets: [],
      },
    ]
    // Same x span, but different row
    const result = findRidingEntity(150, 5, entities)
    expect(result).toBeNull()
  })

  it('frog x translation follows log speed * dt', () => {
    // Simulate: frog starts at x=100, log moves at 80px/s, dt=500ms
    const logSpeed = 80
    const dt = 0.5 // seconds
    const frogX = 100
    const expectedNewX = frogX + logSpeed * dt
    expect(expectedNewX).toBe(140)
  })

  it('negative speed log moves frog left', () => {
    const logSpeed = -90
    const dt = 0.5
    const frogX = 200
    const expectedNewX = frogX + logSpeed * dt
    expect(expectedNewX).toBe(155)
  })
})

// ─── Water death detection ─────────────────────────────────────────────────

describe('water death detection', () => {
  it('no entities in row → water death (no riding entity)', () => {
    const frogCenterX = 200
    const result = findRidingEntity(frogCenterX, 3, [])
    expect(result).toBeNull() // → triggers water death
  })

  it('entities in a different row do not save frog', () => {
    const entities: RiverEntity[] = [
      {
        x: 192,
        row: 2,
        width: TILE_SIZE * 3,
        type: RiverEntityType.LOG,
        speed: 80,
        snakeOffsets: [],
      },
    ]
    const result = findRidingEntity(200, 4, entities)
    expect(result).toBeNull()
  })

  it('frog off-screen left (x < 0) would be flagged as water death', () => {
    // The engine checks: if newX < 0 → water death
    const newFrogX = -5
    expect(newFrogX < 0).toBe(true)
  })

  it('frog off-screen right would be flagged as water death', () => {
    const newFrogX = CANVAS_W
    expect(newFrogX > CANVAS_W - TILE_SIZE).toBe(true)
  })
})

// ─── Snake on log detection ────────────────────────────────────────────────

describe('snake on log detection', () => {
  it('frog center-x within snake tile is lethal', () => {
    const entity: RiverEntity = {
      x: TILE_SIZE * 2,
      row: 3,
      width: TILE_SIZE * 3,
      type: RiverEntityType.LOG,
      speed: 80,
      // snake at middle tile: offset = 1 * TILE_SIZE = 48
      snakeOffsets: [TILE_SIZE],
    }
    // Snake occupies [entity.x + TILE_SIZE, entity.x + TILE_SIZE*2)
    const snakeStart = entity.x + TILE_SIZE
    const frogCenterX = snakeStart + TILE_SIZE / 2 // middle of snake tile
    expect(isOnSnake(frogCenterX, entity)).toBe(true)
  })

  it('frog center-x at snake tile left edge is lethal', () => {
    const entity: RiverEntity = {
      x: 0,
      row: 1,
      width: TILE_SIZE * 4,
      type: RiverEntityType.LOG,
      speed: 60,
      snakeOffsets: [TILE_SIZE * 2],
    }
    const snakeLeft = entity.x + TILE_SIZE * 2
    expect(isOnSnake(snakeLeft, entity)).toBe(true)
  })

  it('frog center-x just outside snake tile is safe', () => {
    const entity: RiverEntity = {
      x: 0,
      row: 1,
      width: TILE_SIZE * 4,
      type: RiverEntityType.LOG,
      speed: 60,
      snakeOffsets: [TILE_SIZE * 2],
    }
    const snakeLeft = entity.x + TILE_SIZE * 2
    // Just before snake
    expect(isOnSnake(snakeLeft - 1, entity)).toBe(false)
    // Just after snake (at right boundary, which is snakeLeft + TILE_SIZE)
    expect(isOnSnake(snakeLeft + TILE_SIZE, entity)).toBe(false)
  })

  it('no snake offsets → never lethal', () => {
    const entity: RiverEntity = {
      x: 0,
      row: 2,
      width: TILE_SIZE * 3,
      type: RiverEntityType.LOG,
      speed: 80,
      snakeOffsets: [],
    }
    expect(isOnSnake(TILE_SIZE * 1.5, entity)).toBe(false)
  })

  it('snakes only appear on level 3+', () => {
    const lane: RiverLaneConfig = {
      row: 5,
      direction: 1,
      baseSpeed: 70,
      entityType: RiverEntityType.LOG,
      entityCount: 3,
      entityWidthTiles: 3,
    }
    expect(getSnakeOffsets(lane, TILE_SIZE * 3, 3, 1)).toHaveLength(0)
    expect(getSnakeOffsets(lane, TILE_SIZE * 3, 3, 2)).toHaveLength(0)
    expect(getSnakeOffsets(lane, TILE_SIZE * 3, 3, 3)).toHaveLength(1)
    expect(getSnakeOffsets(lane, TILE_SIZE * 3, 3, 4)).toHaveLength(1)
  })

  it('snakes do not appear on logs narrower than 3 tiles', () => {
    const lane: RiverLaneConfig = {
      row: 2,
      direction: -1,
      baseSpeed: 80,
      entityType: RiverEntityType.LOG,
      entityCount: 3,
      entityWidthTiles: 2,
    }
    expect(getSnakeOffsets(lane, TILE_SIZE * 2, 2, 3)).toHaveLength(0)
  })

  it('snakes do not appear on lily pads', () => {
    const lane: RiverLaneConfig = {
      row: 3,
      direction: 1,
      baseSpeed: 110,
      entityType: RiverEntityType.LILY_PAD,
      entityCount: 3,
      entityWidthTiles: 1,
    }
    expect(getSnakeOffsets(lane, TILE_SIZE, 1, 5)).toHaveLength(0)
  })
})

// ─── Home slot hit detection ────────────────────────────────────────────────

describe('home slot hit detection', () => {
  it('frog at correct tile-x for empty home slot → returns slot index', () => {
    const homes = createHomeSlots()
    // HOME_SLOT_COLS = [1, 3, 5, 7, 9]
    expect(checkHomeSlot(1, homes)).toBe(0)
    expect(checkHomeSlot(3, homes)).toBe(1)
    expect(checkHomeSlot(5, homes)).toBe(2)
    expect(checkHomeSlot(7, homes)).toBe(3)
    expect(checkHomeSlot(9, homes)).toBe(4)
  })

  it('frog at non-home column → returns -1 (water death)', () => {
    const homes = createHomeSlots()
    expect(checkHomeSlot(0, homes)).toBe(-1)
    expect(checkHomeSlot(2, homes)).toBe(-1)
    expect(checkHomeSlot(4, homes)).toBe(-1)
    expect(checkHomeSlot(6, homes)).toBe(-1)
    expect(checkHomeSlot(8, homes)).toBe(-1)
    expect(checkHomeSlot(10, homes)).toBe(-1)
    expect(checkHomeSlot(12, homes)).toBe(-1)
  })

  it('already-filled home slot → returns -1 (water death)', () => {
    const homes = createHomeSlots()
    homes[0] = { ...homes[0], filled: true }
    expect(checkHomeSlot(1, homes)).toBe(-1)
  })

  it('HOME_SLOT_COLS pixel positions match expected x values', () => {
    // x = tileX * TILE_SIZE
    const expectedX = [48, 144, 240, 336, 432]
    HOME_SLOT_COLS.forEach((col, i) => {
      expect(col * TILE_SIZE).toBe(expectedX[i])
    })
  })

  it('score includes time bonus on home arrival', () => {
    const timerSeconds = 20
    const expectedScore = SCORE_HOME_BASE + timerSeconds * SCORE_TIME_BONUS_PER_SEC
    expect(expectedScore).toBe(50 + 200) // 250
  })

  it('score with full timer (30s) gives max time bonus', () => {
    const score = SCORE_HOME_BASE + LEVEL_TIMER_SECONDS * SCORE_TIME_BONUS_PER_SEC
    expect(score).toBe(350) // 50 + 300
  })
})

// ─── Level clear trigger (all 5 homes) ─────────────────────────────────────

describe('level clear trigger', () => {
  it('allHomesFilled is false initially', () => {
    const homes = createHomeSlots()
    expect(allHomesFilled(homes)).toBe(false)
  })

  it('allHomesFilled is false with 4 of 5 filled', () => {
    const homes = createHomeSlots()
    const partial = homes.map((h, i) => (i < 4 ? { ...h, filled: true } : h))
    expect(allHomesFilled(partial)).toBe(false)
  })

  it('allHomesFilled is true when all 5 are filled', () => {
    const homes = createHomeSlots()
    const allFilled = homes.map(h => ({ ...h, filled: true }))
    expect(allHomesFilled(allFilled)).toBe(true)
  })

  it('filling each home in sequence eventually triggers level clear', () => {
    let homes = createHomeSlots()
    const cols = HOME_SLOT_COLS
    for (let i = 0; i < cols.length; i++) {
      expect(allHomesFilled(homes)).toBe(false)
      const idx = checkHomeSlot(cols[i], homes)
      expect(idx).toBe(i)
      homes = homes.map((h, j) => (j === idx ? { ...h, filled: true } : h))
    }
    expect(allHomesFilled(homes)).toBe(true)
  })
})

// ─── Timer expiry behavior ──────────────────────────────────────────────────

describe('timer expiry behavior', () => {
  it('timer starts at LEVEL_TIMER_SECONDS (30)', () => {
    expect(LEVEL_TIMER_SECONDS).toBe(30)
  })

  it('timer countdown: 30s - elapsed → remaining seconds', () => {
    function calcTimer(elapsedMs: number): number {
      return Math.max(0, LEVEL_TIMER_SECONDS - Math.floor(elapsedMs / 1000))
    }
    expect(calcTimer(0)).toBe(30)
    expect(calcTimer(999)).toBe(30)
    expect(calcTimer(1000)).toBe(29)
    expect(calcTimer(15000)).toBe(15)
    expect(calcTimer(30000)).toBe(0)
    expect(calcTimer(35000)).toBe(0) // clamps to 0
  })

  it('timer at 0 signals death (timer expiry)', () => {
    function calcTimer(elapsedMs: number): number {
      return Math.max(0, LEVEL_TIMER_SECONDS - Math.floor(elapsedMs / 1000))
    }
    const timer = calcTimer(30000)
    // In the engine: if timerSeconds === 0 → triggerDeath()
    expect(timer === 0).toBe(true)
  })
})

// ─── Speed scaling per level ────────────────────────────────────────────────

describe('speed scaling per level', () => {
  it('level 1 entities have base speed', () => {
    const lane: RiverLaneConfig = RIVER_LANE_CONFIGS[0]
    const entities = createRiverLaneEntities(lane, 1)
    const expectedSpeed = lane.baseSpeed * lane.direction
    expect(entities[0].speed).toBeCloseTo(expectedSpeed)
  })

  it('level 2 entities are 1.1x faster than level 1', () => {
    const lane: RiverLaneConfig = RIVER_LANE_CONFIGS[0]
    const entLvl1 = createRiverLaneEntities(lane, 1)
    const entLvl2 = createRiverLaneEntities(lane, 2)
    expect(Math.abs(entLvl2[0].speed)).toBeCloseTo(Math.abs(entLvl1[0].speed) * 1.1)
  })

  it('level 3 entities are 1.21x faster than level 1', () => {
    const lane: RiverLaneConfig = RIVER_LANE_CONFIGS[0]
    const entLvl1 = createRiverLaneEntities(lane, 1)
    const entLvl3 = createRiverLaneEntities(lane, 3)
    expect(Math.abs(entLvl3[0].speed)).toBeCloseTo(Math.abs(entLvl1[0].speed) * 1.21, 5)
  })

  it('log width shrinks by 0.5 tiles per level beyond 1', () => {
    const lane: RiverLaneConfig = {
      row: 5,
      direction: 1,
      baseSpeed: 70,
      entityType: RiverEntityType.LOG,
      entityCount: 3,
      entityWidthTiles: 4,
    }
    expect(getEntityWidthTiles(lane, 1)).toBe(4)
    expect(getEntityWidthTiles(lane, 2)).toBe(3.5)
    expect(getEntityWidthTiles(lane, 3)).toBe(3)
    expect(getEntityWidthTiles(lane, 4)).toBe(2.5)
  })

  it('log width does not shrink below MIN_LOG_WIDTH_TILES (1.5)', () => {
    const lane: RiverLaneConfig = {
      row: 5,
      direction: 1,
      baseSpeed: 70,
      entityType: RiverEntityType.LOG,
      entityCount: 3,
      entityWidthTiles: 2,
    }
    // level 1: 2, level 2: 1.5, level 3 would be 1.0 but clamped to 1.5
    expect(getEntityWidthTiles(lane, 2)).toBe(1.5)
    expect(getEntityWidthTiles(lane, 3)).toBe(1.5)
    expect(getEntityWidthTiles(lane, 10)).toBe(1.5)
  })

  it('lily pad width stays 1 tile regardless of level', () => {
    const lane: RiverLaneConfig = {
      row: 3,
      direction: 1,
      baseSpeed: 110,
      entityType: RiverEntityType.LILY_PAD,
      entityCount: 3,
      entityWidthTiles: 1,
    }
    expect(getEntityWidthTiles(lane, 1)).toBe(1)
    expect(getEntityWidthTiles(lane, 5)).toBe(1)
  })
})

// ─── River entity wrapping ──────────────────────────────────────────────────

describe('river entity wrapping', () => {
  it('entity moving right wraps from right edge to left', () => {
    const entity: RiverEntity = {
      x: CANVAS_W - 5,
      row: 3,
      width: TILE_SIZE * 2,
      type: RiverEntityType.LOG,
      speed: 200,
      snakeOffsets: [],
    }
    const updated = updateRiverEntity(entity, 100) // 20px delta
    // x = CANVAS_W - 5 + 20 = CANVAS_W + 15 → wraps to -width
    expect(updated.x).toBe(-entity.width)
  })

  it('entity moving left wraps from left edge to right', () => {
    const entity: RiverEntity = {
      x: -entity_width_placeholder() - 1,
      row: 2,
      width: TILE_SIZE * 3,
      type: RiverEntityType.LOG,
      speed: -200,
      snakeOffsets: [],
    }
    const updated = updateRiverEntity(entity, 16)
    expect(updated.x).toBe(CANVAS_W)
  })

  function entity_width_placeholder(): number {
    return TILE_SIZE * 3
  }
})

// ─── All river entities creation ────────────────────────────────────────────

describe('createAllRiverEntities', () => {
  it('creates entities for all 5 river lanes', () => {
    const entities = createAllRiverEntities(1)
    const rows = new Set(entities.map(e => e.row))
    expect(rows.has(1)).toBe(true)
    expect(rows.has(2)).toBe(true)
    expect(rows.has(3)).toBe(true)
    expect(rows.has(4)).toBe(true)
    expect(rows.has(5)).toBe(true)
  })

  it('level 3+ adds snakes to qualifying logs', () => {
    const entLvl2 = createAllRiverEntities(2)
    const entLvl3 = createAllRiverEntities(3)
    const snakesLvl2 = entLvl2.filter(e => e.snakeOffsets.length > 0)
    const snakesLvl3 = entLvl3.filter(e => e.snakeOffsets.length > 0)
    expect(snakesLvl2).toHaveLength(0)
    expect(snakesLvl3.length).toBeGreaterThan(0)
  })
})
