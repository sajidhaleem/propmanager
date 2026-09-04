import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { apiError } from '@/lib/utils'
import { hotelEyeSecretValid } from '@/lib/hotelEyeAuth'
import { MAX_ATTEMPTS, staleCutoff, ABANDONED_REASON, GAVE_UP_REASON } from '@/lib/hotelEyeQueue'

export const dynamic = 'force-dynamic'

/**
 * Return abandoned jobs to the queue before claiming a new one.
 *
 * Runs here rather than on a schedule because every worker poll passes through
 * this route: whenever anything is alive to do the work, the reaper has just
 * run. No cron, no second process to forget about.
 *
 * `attempts` is incremented by the claim below, so by the time a job is reaped
 * it already counts this try. A job that has burned through MAX_ATTEMPTS is
 * failed rather than handed back, and the outcome is mirrored onto the booking
 * so the desk can see the guest needs filing by hand.
 */
async function reapAbandonedJobs() {
  const abandoned = await prisma.$queryRaw<{ id: string; attempts: number; bookingId: string | null }[]>`
    UPDATE "HotelEyeJob"
    SET status = CASE WHEN attempts >= ${MAX_ATTEMPTS} THEN 'failed' ELSE 'pending' END,
        error  = CASE WHEN attempts >= ${MAX_ATTEMPTS} THEN ${GAVE_UP_REASON} ELSE ${ABANDONED_REASON} END,
        "updatedAt" = NOW()
    WHERE status = 'processing' AND "updatedAt" <= ${staleCutoff()}
    RETURNING id, attempts, "bookingId"
  `

  const givenUp = abandoned.filter(j => j.bookingId && j.attempts >= MAX_ATTEMPTS)
  if (givenUp.length > 0) {
    await prisma.booking.updateMany({
      // never overwrite a filing that actually landed
      where: { id: { in: givenUp.map(j => j.bookingId!) }, hotelEyeStatus: { not: 'ENTERED' } },
      data: { hotelEyeStatus: 'FAILED', hotelEyeError: GAVE_UP_REASON },
    }).catch(() => {/* the job outcome is recorded either way */})
  }

  return abandoned.length
}

// GET — Flask polls this every 10s to pick up the oldest pending job
export async function GET(req: NextRequest) {
  if (!hotelEyeSecretValid(req.headers.get('x-hotel-eye-secret'))) {
    return apiError('Forbidden', 403)
  }

  await reapAbandonedJobs()

  // Atomic claim: SELECT ... FOR UPDATE SKIP LOCKED prevents two pollers grabbing the same job
  const rows = await prisma.$queryRaw<{ id: string; payload: unknown }[]>`
    UPDATE "HotelEyeJob"
    SET status = 'processing', attempts = attempts + 1, "updatedAt" = NOW()
    WHERE id = (
      SELECT id FROM "HotelEyeJob"
      WHERE status = 'pending'
      ORDER BY "createdAt" ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, payload
  `

  if (!rows.length) return NextResponse.json({ job: null })

  return NextResponse.json({ job: { id: rows[0].id, payload: rows[0].payload } })
}
