export const Direction = {
  UP: 'up',
  DOWN: 'down',
  LEFT: 'left',
  RIGHT: 'right',
  NONE: 'none',
} as const
export type Direction = typeof Direction[keyof typeof Direction]

export const GameState = {
  MODE_SELECT: 'mode_select',
  PLAYING: 'playing',
  GAME_OVER: 'game_over',
} as const
export type GameState = typeof GameState[keyof typeof GameState]

export const GameMode = {
  CLASSIC: 'classic',
  DAILY: 'daily',
} as const
export type GameMode = typeof GameMode[keyof typeof GameMode]

export const VehicleType = {
  CAR: 'car',
  TRUCK: 'truck',
} as const
export type VehicleType = typeof VehicleType[keyof typeof VehicleType]

export const RiverEntityType = {
  LOG: 'log',
  LILY_PAD: 'lily_pad',
} as const
export type RiverEntityType = typeof RiverEntityType[keyof typeof RiverEntityType]

export interface FrogState {
  col: number
  row: number
  // pixel-x position (derived from col, but updated sub-tile when riding logs)
  x: number
  facing: Direction
  deathFlashFrames: number
  alive: boolean
}

export interface VehicleState {
  x: number
  row: number
  width: number
  type: VehicleType
  speed: number // pixels per second, signed (positive = right, negative = left)
}

export interface LaneConfig {
  row: number
  direction: 1 | -1
  baseSpeed: number // pixels per second
  vehicleCount: number
  vehicleType: VehicleType
}

export interface RiverLaneConfig {
  row: number
  direction: 1 | -1
  baseSpeed: number
  entityType: RiverEntityType
  entityCount: number
  entityWidthTiles: number // width of each entity in tiles (1 for lily pad, 2-4 for logs)
}

export interface RiverEntity {
  x: number         // left edge in pixels
  row: number
  width: number     // in pixels
  type: RiverEntityType
  speed: number     // pixels per second, signed
  // snakes: tile indices (relative to entity left) that are lethal
  snakeOffsets: number[] // in pixels from entity left edge
}

export interface HomeSlot {
  tileX: number // the tile column (1,3,5,7,9)
  filled: boolean
}
