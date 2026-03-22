import type { RiverEntity, RiverLaneConfig, HomeSlot } from './types.ts'
import {
  CANVAS_W,
  TILE_SIZE,
  HOME_SLOT_COLS,
  LEVEL_SPEED_MULTIPLIER,
  MIN_LOG_WIDTH_TILES,
  RIVER_LANE_CONFIGS,
} from './constants.ts'
import { RiverEntityType } from './types.ts'

/**
 * Build the initial set of river entities for a lane, spaced evenly.
 */
export function createRiverLaneEntities(lane: RiverLaneConfig, level: number = 1): RiverEntity[] {
  const widthTiles = getEntityWidthTiles(lane, level)
  const widthPx = widthTiles * TILE_SIZE
  const speed = lane.baseSpeed * lane.direction * Math.pow(LEVEL_SPEED_MULTIPLIER, level - 1)
  const spacing = Math.floor(CANVAS_W / lane.entityCount)
  const entities: RiverEntity[] = []

  for (let i = 0; i < lane.entityCount; i++) {
    let x: number
    if (lane.direction === 1) {
      x = i * spacing
    } else {
      x = CANVAS_W - i * spacing - widthPx
    }

    const snakeOffsets = getSnakeOffsets(lane, widthPx, widthTiles, level)

    entities.push({
      x,
      row: lane.row,
      width: widthPx,
      type: lane.entityType,
      speed,
      snakeOffsets,
    })
  }

  return entities
}

/**
 * Get the effective entity width in tiles, accounting for level shrinkage.
 * Each level beyond 1 shrinks log width by 0.5 tiles (min 1.5 tiles).
 */
export function getEntityWidthTiles(lane: RiverLaneConfig, level: number): number {
  if (lane.entityType === RiverEntityType.LILY_PAD) {
    return 1
  }
  const shrink = (level - 1) * 0.5
  return Math.max(MIN_LOG_WIDTH_TILES, lane.entityWidthTiles - shrink)
}

/**
 * Return snake offset pixels for an entity (only for level >= 3, logs with >= 3 tiles).
 * Returns an array of pixel offsets from the entity's left edge; each is the start of
 * a lethal tile (one full TILE_SIZE tile is lethal from that offset).
 */
export function getSnakeOffsets(
  lane: RiverLaneConfig,
  _widthPx: number,
  widthTiles: number,
  level: number
): number[] {
  if (level < 3) return []
  if (lane.entityType !== RiverEntityType.LOG) return []
  if (widthTiles < 3) return []
  // One snake per long log, placed in the middle tile
  const middleTileIndex = Math.floor(widthTiles / 2)
  return [middleTileIndex * TILE_SIZE]
}

/**
 * Update a river entity's position with delta time and wrap around canvas edges.
 */
export function updateRiverEntity(entity: RiverEntity, deltaMs: number): RiverEntity {
  const dx = entity.speed * (deltaMs / 1000)
  let newX = entity.x + dx

  if (entity.speed > 0 && newX >= CANVAS_W) {
    newX = -entity.width
  }
  if (entity.speed < 0 && newX + entity.width < 0) {
    newX = CANVAS_W
  }

  return { ...entity, x: newX }
}

/**
 * Check if a frog center-x is within a river entity's x span.
 * Returns the entity if riding, null otherwise.
 */
export function findRidingEntity(
  frogCenterX: number,
  frogRow: number,
  entities: RiverEntity[]
): RiverEntity | null {
  for (const entity of entities) {
    if (entity.row !== frogRow) continue
    if (frogCenterX >= entity.x && frogCenterX <= entity.x + entity.width) {
      return entity
    }
  }
  return null
}

/**
 * Check if frog center-x is on a snake tile within a riding entity.
 * Snake occupies [entity.x + snakeOffset, entity.x + snakeOffset + TILE_SIZE).
 */
export function isOnSnake(frogCenterX: number, entity: RiverEntity): boolean {
  for (const offset of entity.snakeOffsets) {
    const snakeLeft = entity.x + offset
    const snakeRight = snakeLeft + TILE_SIZE
    if (frogCenterX >= snakeLeft && frogCenterX < snakeRight) {
      return true
    }
  }
  return false
}

/**
 * Create initial home slots.
 */
export function createHomeSlots(): HomeSlot[] {
  return HOME_SLOT_COLS.map(tileX => ({ tileX, filled: false }))
}

/**
 * Check if a frog at tileX (col) matches an unfilled home slot.
 * Returns the matched slot index or -1.
 */
export function checkHomeSlot(frogTileX: number, homes: HomeSlot[]): number {
  for (let i = 0; i < homes.length; i++) {
    if (homes[i].tileX === frogTileX && !homes[i].filled) {
      return i
    }
  }
  return -1
}

/**
 * Check if all homes are filled.
 */
export function allHomesFilled(homes: HomeSlot[]): boolean {
  return homes.every(h => h.filled)
}

/**
 * Build all river entities for all lanes at a given level.
 */
export function createAllRiverEntities(level: number): RiverEntity[] {
  return RIVER_LANE_CONFIGS.flatMap(lane => createRiverLaneEntities(lane, level))
}
