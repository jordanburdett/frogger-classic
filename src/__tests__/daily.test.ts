import { describe, it, expect } from 'vitest'
import { mulberry32 } from '../game/prng.ts'
import {
  getDailyKey,
  getDailySeed,
  buildEmojiRow,
  buildShareText,
  generateDailyConfig,
} from '../game/daily.ts'
import type { HomeAttemptResult, DailyResult } from '../game/daily.ts'

// ─── mulberry32 PRNG ─────────────────────────────────────────────────────────

describe('mulberry32 PRNG', () => {
  it('returns a value in [0, 1)', () => {
    const rng = mulberry32(12345)
    for (let i = 0; i < 100; i++) {
      const v = rng()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('produces deterministic output for the same seed', () => {
    const rng1 = mulberry32(99999)
    const rng2 = mulberry32(99999)
    for (let i = 0; i < 10; i++) {
      expect(rng1()).toBe(rng2())
    }
  })

  it('different seeds produce different sequences', () => {
    const rng1 = mulberry32(1)
    const rng2 = mulberry32(2)
    const values1 = Array.from({ length: 5 }, () => rng1())
    const values2 = Array.from({ length: 5 }, () => rng2())
    expect(values1).not.toEqual(values2)
  })

  it('values are distributed across [0,1) (rough uniformity check)', () => {
    const rng = mulberry32(42)
    const N = 1000
    let under05 = 0
    for (let i = 0; i < N; i++) {
      if (rng() < 0.5) under05++
    }
    // Should be roughly 50%, allow 40%-60%
    expect(under05 / N).toBeGreaterThan(0.4)
    expect(under05 / N).toBeLessThan(0.6)
  })
})

// ─── Daily key and seed ───────────────────────────────────────────────────────

describe('getDailyKey', () => {
  it('returns YYYYMMDD format', () => {
    const date = new Date(2026, 2, 21) // March 21 2026
    expect(getDailyKey(date)).toBe('20260321')
  })

  it('zero-pads month and day', () => {
    const date = new Date(2026, 0, 5) // Jan 5 2026
    expect(getDailyKey(date)).toBe('20260105')
  })
})

describe('getDailySeed', () => {
  it('returns year*10000 + (month+1)*100 + day', () => {
    const date = new Date(2026, 2, 21) // March 21 2026
    expect(getDailySeed(date)).toBe(2026 * 10000 + 3 * 100 + 21)
  })

  it('produces same seed for the same date', () => {
    const date = new Date(2026, 5, 15) // June 15 2026
    expect(getDailySeed(date)).toBe(getDailySeed(date))
  })

  it('different dates produce different seeds', () => {
    const d1 = new Date(2026, 2, 21)
    const d2 = new Date(2026, 2, 22)
    expect(getDailySeed(d1)).not.toBe(getDailySeed(d2))
  })
})

// ─── Emoji row ────────────────────────────────────────────────────────────────

describe('buildEmojiRow', () => {
  it('maps safe to frog emoji', () => {
    const attempts: HomeAttemptResult[] = ['safe', 'safe', 'safe', 'safe', 'safe']
    expect(buildEmojiRow(attempts)).toBe('🐸🐸🐸🐸🐸')
  })

  it('maps died to skull emoji', () => {
    const attempts: HomeAttemptResult[] = ['died', 'died', 'died', 'died', 'died']
    expect(buildEmojiRow(attempts)).toBe('💀💀💀💀💀')
  })

  it('maps unreached to black square', () => {
    const attempts: HomeAttemptResult[] = ['unreached', 'unreached', 'unreached', 'unreached', 'unreached']
    expect(buildEmojiRow(attempts)).toBe('⬛⬛⬛⬛⬛')
  })

  it('produces mixed row correctly', () => {
    const attempts: HomeAttemptResult[] = ['safe', 'died', 'unreached', 'safe', 'died']
    expect(buildEmojiRow(attempts)).toBe('🐸💀⬛🐸💀')
  })
})

// ─── Share text ───────────────────────────────────────────────────────────────

describe('buildShareText', () => {
  it('includes date key, frogs home, score, and emoji row', () => {
    const result: DailyResult = {
      dateKey: '20260321',
      frogsHome: 3,
      finalScore: 820,
      attempts: ['safe', 'died', 'safe', 'unreached', 'safe'],
    }
    const text = buildShareText(result)
    expect(text).toContain('20260321')
    expect(text).toContain('3/5')
    expect(text).toContain('820')
    expect(text).toContain('🐸💀🐸⬛🐸')
    expect(text).toContain('actuallyfun.games')
  })
})

// ─── generateDailyConfig ─────────────────────────────────────────────────────

describe('generateDailyConfig', () => {
  it('produces 5 rounds', () => {
    const config = generateDailyConfig(new Date(2026, 2, 21))
    expect(config.rounds).toHaveLength(5)
  })

  it('same date produces identical config', () => {
    const d = new Date(2026, 5, 10)
    const c1 = generateDailyConfig(d)
    const c2 = generateDailyConfig(d)
    expect(c1).toEqual(c2)
  })

  it('different dates produce different configs', () => {
    const c1 = generateDailyConfig(new Date(2026, 2, 21))
    const c2 = generateDailyConfig(new Date(2026, 2, 22))
    // Lane speed multipliers for round 0 should differ
    expect(c1.rounds[0].laneSpeedMultipliers[0]).not.toBe(c2.rounds[0].laneSpeedMultipliers[0])
  })

  it('lane speed multipliers are within [0.7, 1.4]', () => {
    const config = generateDailyConfig(new Date(2026, 2, 21))
    for (const round of config.rounds) {
      for (const mul of round.laneSpeedMultipliers) {
        expect(mul).toBeGreaterThanOrEqual(0.7)
        expect(mul).toBeLessThanOrEqual(1.4)
      }
    }
  })

  it('vehicle counts are within [2, 5]', () => {
    const config = generateDailyConfig(new Date(2026, 2, 21))
    for (const round of config.rounds) {
      for (const count of round.vehicleCounts) {
        expect(count).toBeGreaterThanOrEqual(2)
        expect(count).toBeLessThanOrEqual(5)
      }
    }
  })

  it('log width tiles are within [1.5, 4.0]', () => {
    const config = generateDailyConfig(new Date(2026, 2, 21))
    for (const round of config.rounds) {
      for (const w of round.logWidthTiles) {
        expect(w).toBeGreaterThanOrEqual(1.5)
        expect(w).toBeLessThanOrEqual(4.0)
      }
    }
  })

  it('stores the dateKey correctly', () => {
    const d = new Date(2026, 2, 21)
    const config = generateDailyConfig(d)
    expect(config.dateKey).toBe('20260321')
  })
})
