import {
  isStale, staleCutoff, reapDecision,
  STALE_PROCESSING_MINUTES, MAX_ATTEMPTS,
} from '@/lib/hotelEyeQueue'

const MIN = 60 * 1000
const NOW = new Date('2026-09-04T12:00:00Z')

describe('isStale', () => {
  it('leaves a job that was only just claimed alone', () => {
    expect(isStale(new Date(NOW.getTime() - 1 * MIN), NOW)).toBe(false)
  })

  /* The worker enforces its own 10-minute timeout, so the window has to sit
     above that — reaping at 5 would snatch back jobs still legitimately running. */
  it('leaves a job inside the worker\'s own 10-minute timeout alone', () => {
    expect(STALE_PROCESSING_MINUTES).toBeGreaterThan(10)
    expect(isStale(new Date(NOW.getTime() - 10 * MIN), NOW)).toBe(false)
  })

  it('reaps exactly at the boundary, not a minute later', () => {
    expect(isStale(new Date(NOW.getTime() - STALE_PROCESSING_MINUTES * MIN), NOW)).toBe(true)
  })

  // the two rows found in production, claimed and never reported on again
  it('reaps a job abandoned for weeks', () => {
    expect(isStale(new Date(NOW.getTime() - 58 * 24 * 60 * MIN), NOW)).toBe(true)
  })

  it('accepts an ISO string as well as a Date', () => {
    expect(isStale(new Date(NOW.getTime() - 60 * MIN).toISOString(), NOW)).toBe(true)
  })
})

describe('staleCutoff', () => {
  it('is the window behind now', () => {
    expect(staleCutoff(NOW).getTime()).toBe(NOW.getTime() - STALE_PROCESSING_MINUTES * MIN)
  })
})

describe('reapDecision', () => {
  it('hands an early attempt back to the queue', () => {
    expect(reapDecision(1)).toBe('requeue')
  })

  /* Without a cap, a job that kills the worker every time is handed straight
     back for ever — and being oldest-first it blocks everything behind it. */
  it('gives up once the attempts are spent', () => {
    expect(reapDecision(MAX_ATTEMPTS)).toBe('fail')
    expect(reapDecision(MAX_ATTEMPTS + 1)).toBe('fail')
  })

  it('gives up on the attempt before the cap is exceeded, not after', () => {
    expect(reapDecision(MAX_ATTEMPTS - 1)).toBe('requeue')
  })
})
