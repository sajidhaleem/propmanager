import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { apiError } from '@/lib/utils'

export const dynamic = 'force-dynamic'

// Called by the web app Send button — creates a job in the DB
export async function POST(req: NextRequest) {
  try {
    await requireAuth(req)
    /* `force` is a control flag for this route, not guest data — keep it out of
       the payload handed to the filing worker. */
    const { force, ...payload } = await req.json()

    // Deduplicate: if same CNIC already has a pending/processing job, reuse it
    const cnic      = (payload as any).cnic      as string | undefined
    const bookingId = (payload as any).bookingId as string | undefined

    /* Already on the portal: queueing again produces a second watch entry for
       one stay. The pending/processing check below cannot catch this — by the
       time a filing succeeds its job is 'done' and stops matching. A repeat
       guest's *next* stay is a different booking and still files normally.
       `force` is the deliberate refile, e.g. the portal lost the entry. */
    if (bookingId && !force) {
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        select: { hotelEyeStatus: true, hotelEyeFiledAt: true },
      })
      if (booking && (booking.hotelEyeStatus === 'ENTERED' || booking.hotelEyeFiledAt)) {
        return NextResponse.json({
          success: true,
          alreadyFiled: true,
          filedAt: booking.hotelEyeFiledAt,
        })
      }
    }

    if (cnic) {
      const existing = await prisma.hotelEyeJob.findFirst({
        where: {
          status: { in: ['pending', 'processing'] },
          ...(bookingId ? { bookingId } : {}),
          payload: { path: ['cnic'], equals: cnic },
        },
        orderBy: { createdAt: 'desc' },
      })
      if (existing) {
        return NextResponse.json({ success: true, jobId: existing.id, reused: true })
      }
    }

    const job = await prisma.hotelEyeJob.create({ data: { payload, bookingId: bookingId ?? null } })

    /* Mark the booking as in-flight so the desk can tell "handed to the filing
       worker" from "nobody has touched this". Only moves bookings that are not
       already on the portal — a re-send must never undo a recorded filing. */
    if (bookingId) {
      await prisma.booking.updateMany({
        where: { id: bookingId, hotelEyeStatus: { in: ['NOT_ENTERED', 'FAILED'] } },
        data: { hotelEyeStatus: 'QUEUED', hotelEyeError: null },
      }).catch(() => {/* non-fatal: the job is queued either way */})
    }

    return NextResponse.json({ success: true, jobId: job.id })
  } catch (err: any) {
    if (err.message === 'Unauthorized') return apiError('Unauthorized', 401)
    console.error('Hotel Eye job create error:', err)
    return apiError('Failed to queue Hotel Eye job', 500)
  }
}
