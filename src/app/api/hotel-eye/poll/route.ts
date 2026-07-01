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

  // Atomic claim: SELECT ... FOR UPDATE SKIP LOCKED prevents two pollers grabbing the same job
  const rows = await prisma.$queryRaw<{ id: string; payload: unknown }[]>`
    UPDATE "HotelEyeJob"
    SET status = 'processing', "updatedAt" = NOW()
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
