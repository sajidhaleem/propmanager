import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { apiError } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(req, ['ADMIN'])
    const { id } = await params
    const backup = await prisma.backup.findUnique({ where: { id } })
    if (!backup) return apiError('Backup not found', 404)

    const { properties, bookings, income, expenses, payouts, documents } = backup.data as any

    await prisma.$transaction(async (tx) => {
      // Clear in FK order (documents cascade with bookings)
      await tx.income.deleteMany()
      await tx.booking.deleteMany()
      await tx.expense.deleteMany()
      await tx.payout.deleteMany()
      await tx.property.deleteMany()

      for (const p of properties) {
        const { createdAt, updatedAt, ...rest } = p
        await tx.property.create({ data: rest })
      }

      for (const b of bookings) {
        const { createdAt, updatedAt, income: _inc, documents: _docs, property: _prop, ...rest } = b
        await tx.booking.create({
          data: { ...rest, checkIn: new Date(rest.checkIn), checkOut: new Date(rest.checkOut) },
        })
      }

      // Older backups have no documents array
      for (const d of documents ?? []) {
        const { createdAt, booking: _b, ...rest } = d
        await tx.document.create({ data: rest })
      }

      for (const i of income) {
        const { createdAt, updatedAt, booking: _b, ...rest } = i
        await tx.income.create({
          data: { ...rest, receivedAt: new Date(rest.receivedAt) },
        })
      }

      for (const e of expenses) {
        const { createdAt, updatedAt, ...rest } = e
        await tx.expense.create({ data: { ...rest, date: new Date(rest.date) } })
      }

      for (const p of payouts) {
        const { createdAt, updatedAt, ...rest } = p
        await tx.payout.create({ data: { ...rest, date: new Date(rest.date) } })
      }
    }, { timeout: 120000 })

    return NextResponse.json({ success: true })
  } catch (e: any) {
    if (e.message === 'Unauthorized') return apiError('Unauthorized', 401)
    if (e.message === 'Forbidden') return apiError('Forbidden', 403)
    console.error('Restore error:', e)
    return apiError('Failed to restore backup', 500)
  }
}
