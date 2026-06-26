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

// GET — Flask polls this every 10s to pick up the oldest pending job
export async function GET(req: NextRequest) {
  if (!checkSecret(req)) return apiError('Forbidden', 403)

  const job = await prisma.hotelEyeJob.findFirst({
    where: { status: 'pending' },
    orderBy: { createdAt: 'asc' },
  })

  if (!job) return NextResponse.json({ job: null })

  // Mark as processing immediately so two pollers don't grab the same job
  await prisma.hotelEyeJob.update({
    where: { id: job.id },
    data: { status: 'processing' },
  })

  return NextResponse.json({ job: { id: job.id, payload: job.payload } })
}
