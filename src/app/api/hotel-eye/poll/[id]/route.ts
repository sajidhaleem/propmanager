import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { apiError } from '@/lib/utils'

export const dynamic = 'force-dynamic'

function checkSecret(req: NextRequest) {
  const token = req.headers.get('x-hotel-eye-secret') || ''
  const expected = process.env.HOTEL_EYE_SECRET || ''
  if (!expected || token !== expected) return false
  return true
}

// PATCH — Flask calls this to mark a job done or failed
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!checkSecret(req)) return apiError('Forbidden', 403)

  const { id } = await params
  const { status, error } = await req.json()

  if (!['done', 'failed', 'pending'].includes(status)) {
    return apiError('status must be done, failed, or pending', 400)
  }

  const job = await prisma.hotelEyeJob.update({
    where: { id },
    data: { status, error: error || null },
  })

  if (status === 'done' && job.bookingId) {
    await prisma.booking.update({
      where: { id: job.bookingId },
      data: { hotelEyeStatus: 'ENTERED' },
    }).catch(() => {/* booking may have been deleted */})
  }

  return NextResponse.json({ success: true })
}
