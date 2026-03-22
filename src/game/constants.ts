import { VehicleType } from './types.ts'
import type { LaneConfig } from './types.ts'

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
export const DELTA_CAP_MS = 50

// Row layout (row 0 = top, row 12 = bottom)
// row 0   = homes (stub)
// rows 1-5 = river (stub)
// row 6   = median/grass (safe)
// rows 7-11 = road (5 lanes)
// row 12  = start/safe

export const ROAD_ROWS = [7, 8, 9, 10, 11] as const
export const SAFE_ROWS = [6, 12] as const

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

// Vehicle pixel widths
export const VEHICLE_WIDTHS: Record<string, number> = {
  [VehicleType.CAR]:   TILE_SIZE * 2,
  [VehicleType.TRUCK]: TILE_SIZE * 3,
}

// Colors
export const COLOR_FROG_BODY = '#5A8C3E'
export const COLOR_FROG_BELLY = '#FFFFFF'
export const COLOR_FROG_EYE = '#1A1A1A'
export const COLOR_FROG_DEAD = '#FF4444'

export const COLOR_CAR_BODY = '#E84040'
export const COLOR_CAR_WINDOW = '#AAD4F5'
export const COLOR_TRUCK_BODY = '#4A90D9'
export const COLOR_TRUCK_WINDOW = '#C8E6FA'

export const COLOR_ROAD = '#555555'
export const COLOR_GRASS = '#4A7C2F'
export const COLOR_MEDIAN = '#5B9E3A'
export const COLOR_LANE_LINE = '#AAAAAA'

export const COLOR_HUD_BG = '#1A1A2E'
export const COLOR_HUD_TEXT = '#FFFFFF'
export const COLOR_SCORE_TEXT = '#FFD700'
