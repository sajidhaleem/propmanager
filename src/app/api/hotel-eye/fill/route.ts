import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { apiError } from '@/lib/utils'

export const dynamic = 'force-dynamic'

// Called by the web app Send button — creates a job in the DB
export async function POST(req: NextRequest) {
  try {
    await requireAuth(req)
    const payload = await req.json()
    const job = await prisma.hotelEyeJob.create({ data: { payload } })
    return NextResponse.json({ success: true, jobId: job.id })
  } catch (err: any) {
    if (err.message === 'Unauthorized') return apiError('Unauthorized', 401)
    console.error('Hotel Eye job create error:', err)
    return apiError('Failed to queue Hotel Eye job', 500)
  }
}
