import { VehicleType, RiverEntityType } from './types.ts'
import type { LaneConfig, RiverLaneConfig } from './types.ts'

export const TILE_SIZE = 48
export const COLS = 13
export const ROWS = 13
export const CANVAS_W = TILE_SIZE * COLS // 624
export const CANVAS_H = TILE_SIZE * ROWS // 624

export const FROG_START_COL = 6
export const FROG_START_ROW = 12

export const INITIAL_LIVES = 3
export const DEATH_FLASH_FRAMES = 30
export const SCORE_PER_ROW = 10
export const SCORE_HOME_BASE = 50
export const SCORE_TIME_BONUS_PER_SEC = 10
export const DELTA_CAP_MS = 50

export const LEVEL_TIMER_SECONDS = 30

// Row layout (row 0 = top, row 12 = bottom)
// row 0    = homes
// rows 1-5 = river (5 lanes)
// row 6    = median/grass (safe)
// rows 7-11 = road (5 lanes)
// row 12   = start/safe

export const ROAD_ROWS = [7, 8, 9, 10, 11] as const
export const RIVER_ROWS = [1, 2, 3, 4, 5] as const
export const SAFE_ROWS = [6, 12] as const
export const HOME_ROW = 0

// Home slot tile columns (cols 1,3,5,7,9 → x = 48,144,240,336,432)
export const HOME_SLOT_COLS = [1, 3, 5, 7, 9] as const

// 5 road lanes, alternating directions
// row 11 (bottom road lane) goes right (direction 1)
// row 10 goes left (direction -1)
// etc.
export const LANE_CONFIGS: LaneConfig[] = [
  { row: 11, direction: 1,  baseSpeed: 80,  vehicleCount: 3, vehicleType: VehicleType.CAR },
  { row: 10, direction: -1, baseSpeed: 100, vehicleCount: 2, vehicleType: VehicleType.TRUCK },
  { row: 9,  direction: 1,  baseSpeed: 120, vehicleCount: 3, vehicleType: VehicleType.CAR },
  { row: 8,  direction: -1, baseSpeed: 90,  vehicleCount: 2, vehicleType: VehicleType.CAR },
  { row: 7,  direction: 1,  baseSpeed: 110, vehicleCount: 4, vehicleType: VehicleType.CAR },
]

// 5 river lanes
// row 5 (closest to safe median) moves right, row 1 (closest to homes) moves right
export const RIVER_LANE_CONFIGS: RiverLaneConfig[] = [
  { row: 5, direction:  1, baseSpeed:  70, entityType: RiverEntityType.LOG,      entityCount: 3, entityWidthTiles: 3 },
  { row: 4, direction: -1, baseSpeed:  90, entityType: RiverEntityType.LOG,      entityCount: 2, entityWidthTiles: 4 },
  { row: 3, direction:  1, baseSpeed: 110, entityType: RiverEntityType.LILY_PAD, entityCount: 3, entityWidthTiles: 1 },
  { row: 2, direction: -1, baseSpeed:  80, entityType: RiverEntityType.LOG,      entityCount: 3, entityWidthTiles: 2 },
  { row: 1, direction:  1, baseSpeed: 100, entityType: RiverEntityType.LILY_PAD, entityCount: 3, entityWidthTiles: 1 },
]

// Vehicle pixel widths
export const VEHICLE_WIDTHS: Record<string, number> = {
  [VehicleType.CAR]:   TILE_SIZE * 2,
  [VehicleType.TRUCK]: TILE_SIZE * 3,
}

// Level speed scaling
export const LEVEL_SPEED_MULTIPLIER = 1.1
export const MIN_LOG_WIDTH_TILES = 1.5

// Colors
export const COLOR_FROG_BODY = '#5A8C3E'
export const COLOR_FROG_BELLY = '#FFFFFF'
export const COLOR_FROG_EYE = '#1A1A1A'
export const COLOR_FROG_DEAD = '#FF4444'

export const COLOR_CAR_BODY = '#E84040'
export const COLOR_CAR_WINDOW = '#AAD4F5'
export const COLOR_TRUCK_BODY = '#4A90D9'
export const COLOR_TRUCK_WINDOW = '#C8E6FA'

export const COLOR_ROAD = '#C87941'        // amber/terracotta per spec
export const COLOR_GRASS = '#5A8C3E'       // sage green
export const COLOR_MEDIAN = '#5A8C3E'      // sage green safe zone
export const COLOR_LANE_LINE = '#FFFFFF'   // white dashed lane markings

export const COLOR_RIVER = '#40C8E0'       // turquoise river
export const COLOR_HOME_ROW = '#2D5A27'    // deep green
export const COLOR_LOG = '#8B5E3C'         // brown log
export const COLOR_LILY_PAD = '#5A8C3E'    // sage green lily pad
export const COLOR_SNAKE = '#228B22'       // forest green snake body
export const COLOR_SNAKE_HEAD = '#FF6600'  // orange snake head

export const COLOR_HUD_BG = '#1A1A2E'
export const COLOR_HUD_TEXT = '#FFFFFF'
export const COLOR_SCORE_TEXT = '#FFD700'

export const COLOR_TIMER_NORMAL = '#FFFFFF'
export const COLOR_TIMER_URGENT = '#FF4444' // flashes when <= 5 seconds left
