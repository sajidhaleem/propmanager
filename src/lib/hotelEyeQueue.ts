/**
 * Recovering filing jobs whose worker never came back.
 *
 * /api/hotel-eye/poll claims a job by flipping it to `processing`. If the
 * worker then dies — the machine sleeps, the process is killed, the shift ends
 * mid-job — nothing ever moves that row again. Production had two sitting in
 * `processing` for 58 and 64 days, each one a guest the desk believed was being
 * filed.
 *
 * The worker enforces its own 10-minute timeout on a form fill and reports
 * `failed` when it trips, so anything still `processing` well past that is not
 * slow, it is gone.
 */

/** Past this, a claimed job is treated as abandoned rather than in progress. */
export const STALE_PROCESSING_MINUTES = 15

/**
 * Claims allowed before the job is given up on. A job that crashes the worker
 * on every attempt would otherwise be handed straight back to the next worker
 * for ever, and being oldest-first it would block every job behind it.
 */
export const MAX_ATTEMPTS = 3

const MINUTE = 60 * 1000

export function staleCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - STALE_PROCESSING_MINUTES * MINUTE)
}

export function isStale(updatedAt: Date | string, now: Date = new Date()): boolean {
  return new Date(updatedAt).getTime() <= staleCutoff(now).getTime()
}

/**
 * What to do with an abandoned job. `attempts` already counts the claim that
 * was abandoned, because the claim increments it — so a job on its MAX_ATTEMPTS
 * try has run out rather than having one more left.
 */
export function reapDecision(attempts: number): 'requeue' | 'fail' {
  return attempts >= MAX_ATTEMPTS ? 'fail' : 'requeue'
}

export const ABANDONED_REASON =
  `Filing worker stopped responding and did not report back within ${STALE_PROCESSING_MINUTES} minutes`

export const GAVE_UP_REASON =
  `Filing worker stopped responding on ${MAX_ATTEMPTS} attempts — needs filing by hand`
