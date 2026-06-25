import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-secret')
  if (secret !== process.env.CLEAR_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await prisma.income.deleteMany()
  await prisma.booking.deleteMany()
  await prisma.expense.deleteMany()
  await prisma.payout.deleteMany()
  await prisma.property.deleteMany()
  await prisma.backup.deleteMany()

  return NextResponse.json({ success: true, message: 'All data cleared' })
}
