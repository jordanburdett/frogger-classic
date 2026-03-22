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

export interface FrogState {
  col: number
  row: number
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
