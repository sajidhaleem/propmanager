import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { apiError } from '@/lib/utils'
import { hotelEyeSecretValid } from '@/lib/hotelEyeAuth'

export const dynamic = 'force-dynamic'

// PATCH — Flask calls this to mark a job done or failed
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!hotelEyeSecretValid(req.headers.get('x-hotel-eye-secret'))) {
    return apiError('Forbidden', 403)
  }

  const { id } = await params
  const { status, error } = await req.json()

  if (!['done', 'failed', 'pending'].includes(status)) {
    return apiError('status must be done, failed, or pending', 400)
  }

  const job = await prisma.hotelEyeJob.update({
    where: { id },
    data: { status, error: error || null },
  })

  /* Mirror the outcome onto the booking. The job table is the worker's
     queue and the app never reads it, so a result that stops here is a
     result nobody ever sees — a failed filing used to be indistinguishable
     from one nobody had attempted. */
  if (job.bookingId) {
    const outcome =
      status === 'done'
        // hotelEyeFiledAt is the timestamp an inspector asks for
        ? { hotelEyeStatus: 'ENTERED', hotelEyeFiledAt: new Date(), hotelEyeError: null }
        : status === 'failed'
          ? { hotelEyeStatus: 'FAILED', hotelEyeError: String(error || 'Filing failed') }
          // requeued: drop back to QUEUED and clear the stale error
          : { hotelEyeStatus: 'QUEUED', hotelEyeError: null }

    await prisma.booking.update({
      where: { id: job.bookingId },
      data: outcome,
    }).catch(() => {/* booking may have been deleted */})
  }

  return NextResponse.json({ success: true })
}
