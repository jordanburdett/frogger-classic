import type { VehicleState, LaneConfig } from './types.ts'
import { CANVAS_W, VEHICLE_WIDTHS, TILE_SIZE } from './constants.ts'

/**
 * Build the initial set of vehicles for a lane, spaced evenly.
 */
export function createLaneVehicles(lane: LaneConfig): VehicleState[] {
  const width = VEHICLE_WIDTHS[lane.vehicleType]
  const speed = lane.baseSpeed * lane.direction
  const spacing = Math.floor(CANVAS_W / lane.vehicleCount)
  const vehicles: VehicleState[] = []

  for (let i = 0; i < lane.vehicleCount; i++) {
    let x: number
    if (lane.direction === 1) {
      // Moving right: start spread across canvas
      x = i * spacing
    } else {
      // Moving left: start from the right side
      x = CANVAS_W - i * spacing - width
    }
    vehicles.push({
      x,
      row: lane.row,
      width,
      type: lane.vehicleType,
      speed,
    })
  }

  return vehicles
}

/**
 * Update a vehicle's position with delta time and wrap around canvas edges.
 */
export function updateVehicle(vehicle: VehicleState, deltaMs: number): VehicleState {
  const dx = vehicle.speed * (deltaMs / 1000)
  let newX = vehicle.x + dx

  // Wrap when going right (positive speed)
  if (vehicle.speed > 0 && newX >= CANVAS_W) {
    newX = -vehicle.width
  }
  // Wrap when going left (negative speed)
  if (vehicle.speed < 0 && newX + vehicle.width < 0) {
    newX = CANVAS_W
  }

  return { ...vehicle, x: newX }
}

/**
 * Check if a frog at (col, row) overlaps with a vehicle.
 * Uses tile-based collision: frog occupies one tile at (col, row).
 */
export function checkVehicleCollision(
  frogCol: number,
  frogRow: number,
  vehicle: VehicleState
): boolean {
  if (vehicle.row !== frogRow) return false
  const vStartTile = Math.floor(vehicle.x / TILE_SIZE)
  const vEndTile = Math.floor((vehicle.x + vehicle.width - 1) / TILE_SIZE)
  return frogCol >= vStartTile && frogCol <= vEndTile
}

/**
 * Get the tile columns occupied by a vehicle (for testing/debug).
 */
export function vehicleTileRange(vehicle: VehicleState): { start: number; end: number } {
  return {
    start: Math.floor(vehicle.x / TILE_SIZE),
    end: Math.floor((vehicle.x + vehicle.width - 1) / TILE_SIZE),
  }
}

/**
 * Scale vehicle speeds by a level multiplier.
 */
export function applyLevelSpeed(vehicle: VehicleState, multiplier: number): VehicleState {
  return {
    ...vehicle,
    speed: vehicle.speed * multiplier,
  }
}
