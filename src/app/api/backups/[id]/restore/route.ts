import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { apiError } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const backup = await prisma.backup.findUnique({ where: { id } })
    if (!backup) return apiError('Backup not found', 404)

    const { properties, bookings, income, expenses, payouts } = backup.data as any

    // Clear in FK order
    await prisma.income.deleteMany()
    await prisma.booking.deleteMany()
    await prisma.expense.deleteMany()
    await prisma.payout.deleteMany()
    await prisma.property.deleteMany()

    // Restore properties
    for (const p of properties) {
      const { createdAt, updatedAt, ...rest } = p
      await prisma.property.create({ data: rest })
    }

    // Restore bookings (exclude income relation)
    for (const b of bookings) {
      const { createdAt, updatedAt, income: _inc, documents: _docs, property: _prop, ...rest } = b
      await prisma.booking.create({
        data: { ...rest, checkIn: new Date(rest.checkIn), checkOut: new Date(rest.checkOut) },
      })
    }

    // Restore income
    for (const i of income) {
      const { createdAt, updatedAt, booking: _b, ...rest } = i
      await prisma.income.create({
        data: { ...rest, receivedAt: new Date(rest.receivedAt) },
      })
    }

    // Restore expenses
    for (const e of expenses) {
      const { createdAt, updatedAt, ...rest } = e
      await prisma.expense.create({ data: { ...rest, date: new Date(rest.date) } })
    }

    // Restore payouts
    for (const p of payouts) {
      const { createdAt, updatedAt, ...rest } = p
      await prisma.payout.create({ data: { ...rest, date: new Date(rest.date) } })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('Restore error:', e)
    return apiError('Failed to restore backup', 500)
  }
}
