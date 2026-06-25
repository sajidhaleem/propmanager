import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-clear-secret')
  if (secret !== process.env.CLEAR_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await prisma.income.deleteMany()
  await prisma.booking.deleteMany()
  await prisma.expense.deleteMany()
  await prisma.payout.deleteMany()
  await prisma.property.deleteMany()
  await prisma.user.deleteMany({
    where: { email: { in: ['manager@propmanager.com', 'staff@propmanager.com'] } },
  })

  return NextResponse.json({ ok: true })
}
