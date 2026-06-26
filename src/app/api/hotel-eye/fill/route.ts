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

    // Deduplicate: if same CNIC already has a pending/processing job, reuse it
    const cnic = (payload as any).cnic as string | undefined
    if (cnic) {
      const existing = await prisma.hotelEyeJob.findFirst({
        where: {
          status: { in: ['pending', 'processing'] },
          payload: { path: ['cnic'], equals: cnic },
        },
        orderBy: { createdAt: 'desc' },
      })
      if (existing) {
        return NextResponse.json({ success: true, jobId: existing.id, reused: true })
      }
    }

    const job = await prisma.hotelEyeJob.create({ data: { payload } })
    return NextResponse.json({ success: true, jobId: job.id })
  } catch (err: any) {
    if (err.message === 'Unauthorized') return apiError('Unauthorized', 401)
    console.error('Hotel Eye job create error:', err)
    return apiError('Failed to queue Hotel Eye job', 500)
  }
}
