import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { apiResponse, handleApiError } from '@/lib/utils'
import { FILING_WINDOW_HOURS } from '@/lib/hotelEye'

export const dynamic = 'force-dynamic'

/**
 * GET /api/hotel-eye/compliance — today's filing position.
 *
 * Answers the two questions an inspection turns on: is every guest who arrived
 * today on the portal, and is anything past its 24-hour window. Computed here
 * over the whole day rather than in the client, which only ever holds one
 * filtered, paginated page of bookings.
 */
export async function GET(req: NextRequest) {
  try {
    await requireAuth(req)

    // Local calendar day — the operator's day in Lahore, not a UTC day
    const now = new Date()
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)
    const overdueCutoff = new Date(now.getTime() - FILING_WINDOW_HOURS * 60 * 60 * 1000)

    const [arrivalsToday, filedToday, overdue, failed] = await Promise.all([
      prisma.booking.count({
        where: { checkIn: { gte: dayStart, lt: dayEnd }, status: { notIn: ['CANCELLED', 'NO_SHOW'] } },
      }),
      prisma.booking.count({
        where: {
          checkIn: { gte: dayStart, lt: dayEnd },
          status: { notIn: ['CANCELLED', 'NO_SHOW'] },
          hotelEyeStatus: 'ENTERED',
        },
      }),
      /* Not scoped to today: an unfiled guest from three days ago is the
         bigger exposure, and it would otherwise never be surfaced. */
      prisma.booking.count({
        where: {
          checkIn: { lt: overdueCutoff },
          status: { notIn: ['CANCELLED', 'NO_SHOW'] },
          hotelEyeStatus: { not: 'ENTERED' },
        },
      }),
      prisma.booking.count({
        where: { hotelEyeStatus: 'FAILED', status: { notIn: ['CANCELLED', 'NO_SHOW'] } },
      }),
    ])

    return apiResponse({
      arrivalsToday,
      filedToday,
      overdue,
      failed,
      // only meaningful when there were arrivals — nothing filed of nothing proves nothing
      clear: arrivalsToday > 0 && filedToday === arrivalsToday && overdue === 0 && failed === 0,
      windowHours: FILING_WINDOW_HOURS,
    })
  } catch (error: any) {
    return handleApiError(error)
  }
}
