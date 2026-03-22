import { mulberry32 } from './prng.ts'
import { LANE_CONFIGS, RIVER_LANE_CONFIGS } from './constants.ts'

/** Pre-seeded configuration for one daily challenge round. */
export interface DailyRoundConfig {
  /** Speed multipliers for each road lane (index matches LANE_CONFIGS order). */
  laneSpeedMultipliers: number[]
  /** Vehicle counts per road lane. */
  vehicleCounts: number[]
  /** Log width multipliers for river lanes (index matches RIVER_LANE_CONFIGS order). */
  logWidthTiles: number[]
}

/** Full daily challenge config: one set of seeds for all 5 rounds. */
export interface DailyConfig {
  dateKey: string
  rounds: DailyRoundConfig[]
}

/** Result of one home-slot attempt. */
export type HomeAttemptResult = 'safe' | 'died' | 'unreached'

export interface DailyResult {
  dateKey: string
  frogsHome: number
  finalScore: number
  attempts: HomeAttemptResult[]
}

/** Get the YYYYMMDD key for today. */
export function getDailyKey(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}${m}${d}`
}

/** Get the numeric seed from a date. */
export function getDailySeed(date: Date = new Date()): number {
  return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate()
}

const DAILY_RESULT_PREFIX = 'frogger-daily-'

/** Load a stored daily result from localStorage. Returns null if not played. */
export function getDailyResult(dateKey: string): DailyResult | null {
  try {
    const raw = localStorage.getItem(`${DAILY_RESULT_PREFIX}${dateKey}`)
    if (!raw) return null
    return JSON.parse(raw) as DailyResult
  } catch {
    return null
  }
}

/** Persist the daily result to localStorage. */
export function saveDailyResult(result: DailyResult): void {
  try {
    localStorage.setItem(
      `${DAILY_RESULT_PREFIX}${result.dateKey}`,
      JSON.stringify(result)
    )
  } catch {
    // localStorage unavailable — silently ignore
  }
}

/**
 * Build a 5-cell emoji row from attempt results.
 * 🐸 = safe home, 💀 = died, ⬛ = unreached
 */
export function buildEmojiRow(attempts: HomeAttemptResult[]): string {
  return attempts
    .map(a => {
      if (a === 'safe') return '🐸'
      if (a === 'died') return '💀'
      return '⬛'
    })
    .join('')
}

/** Build the shareable text for clipboard. */
export function buildShareText(result: DailyResult): string {
  const emojiRow = buildEmojiRow(result.attempts)
  return [
    `Frogger Daily ${result.dateKey}`,
    `${result.frogsHome}/5 🐸 home`,
    `Score: ${result.finalScore}`,
    emojiRow,
    'actuallyfun.games',
  ].join('\n')
}

/**
 * Generate deterministic daily config from the date seed.
 * Uses mulberry32 to produce lane speeds, vehicle counts, and log widths
 * for 5 rounds. Values stay balanced (not too easy / too hard).
 */
export function generateDailyConfig(date: Date = new Date()): DailyConfig {
  const dateKey = getDailyKey(date)
  const seed = getDailySeed(date)
  const rng = mulberry32(seed)

  const rounds: DailyRoundConfig[] = []

  for (let r = 0; r < 5; r++) {
    // Lane speed multipliers: 0.7 – 1.4
    const laneSpeedMultipliers = LANE_CONFIGS.map(() => 0.7 + rng() * 0.7)

    // Vehicle counts: clamp to 2–5
    const vehicleCounts = LANE_CONFIGS.map(lane => {
      const base = lane.vehicleCount
      const delta = Math.floor(rng() * 3) - 1 // -1, 0, or +1
      return Math.max(2, Math.min(5, base + delta))
    })

    // Log width tiles: clamp to 1.5 – 4.0
    const logWidthTiles = RIVER_LANE_CONFIGS.map(lane => {
      const base = lane.entityWidthTiles
      const delta = (rng() - 0.5) * 2 // -1 to +1
      return Math.max(1.5, Math.min(4.0, base + delta))
    })

    rounds.push({ laneSpeedMultipliers, vehicleCounts, logWidthTiles })
  }

  return { dateKey, rounds }
}
