import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, requireRole } from '@/lib/auth'
import { bookingBaseSchema } from '@/lib/validations'
import { apiError, apiResponse } from '@/lib/utils'
import { differenceInCalendarDays } from 'date-fns'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(req)
    const { id } = await params
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        property: true,
        income: true,
      },
    })
    if (!booking) return apiError('Booking not found', 404)
    return apiResponse(booking)
  } catch (error: any) {
    if (error.message === 'Unauthorized') return apiError('Unauthorized', 401)
    return apiError('Internal server error', 500)
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(req, ['ADMIN', 'MANAGER', 'STAFF'])
    const { id } = await params
    const body = await req.json()
    const result = bookingBaseSchema.partial().safeParse(body)
    if (!result.success) return apiError(result.error.errors[0].message)

    const data = result.data
    let extraFields: any = {}

    if (
      data.checkIn || data.checkOut || data.propertyId ||
      data.rate !== undefined || data.cleaningFee !== undefined ||
      data.platformFee !== undefined || data.miscCharges !== undefined
    ) {
      // Re-fetch current booking to fill in any fields not included in the patch
      const current = await prisma.booking.findUnique({ where: { id } })
      if (!current) return apiError('Booking not found', 404)

      const checkIn  = data.checkIn  ? new Date(data.checkIn)  : current.checkIn
      const checkOut = data.checkOut ? new Date(data.checkOut) : current.checkOut
      if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) return apiError('Invalid date')
      if (checkOut <= checkIn) return apiError('Check-out must be after check-in')

      const propertyId = data.propertyId ?? current.propertyId
      if (data.checkIn || data.checkOut || data.propertyId) {
        const conflict = await prisma.booking.findFirst({
          where: {
            id: { not: id },
            propertyId,
            status: { notIn: ['CANCELLED', 'NO_SHOW'] },
            checkIn: { lt: checkOut },
            checkOut: { gt: checkIn },
          },
        })
        if (conflict) return apiError('Property is already booked for these dates', 409)
      }

      const nights = Math.max(1, differenceInCalendarDays(checkOut, checkIn))
      const rate        = data.rate        ?? current.rate
      const cleaningFee = data.cleaningFee ?? current.cleaningFee
      const platformFee = data.platformFee ?? current.platformFee
      const miscCharges = data.miscCharges ?? current.miscCharges ?? 0
      const totalAmount = rate * nights + cleaningFee + miscCharges
      const netAmount   = totalAmount - platformFee
      extraFields = { checkIn, checkOut, nights, totalAmount, netAmount }
    }

    const booking = await prisma.booking.update({
      where: { id },
      data: { ...data, ...extraFields },
      include: { property: { select: { id: true, name: true } } },
    })

    // Auto-create income record when checked out
    if (data.status === 'CHECKED_OUT') {
      const existing = await prisma.income.findUnique({ where: { bookingId: id } })
      if (!existing) {
        await prisma.income.create({
          data: {
            bookingId: id,
            grossAmount: booking.totalAmount,
            platformFee: booking.platformFee,
            cleaningFee: booking.cleaningFee,
            netAmount: booking.netAmount,
            receivedAt: new Date(),
            month: booking.checkOut.getMonth() + 1,
            year: booking.checkOut.getFullYear(),
          },
        })
      }
    }

    return apiResponse(booking)
  } catch (error: any) {
    if (error.message === 'Unauthorized') return apiError('Unauthorized', 401)
    if (error.message === 'Forbidden') return apiError('Forbidden', 403)
    return apiError('Internal server error', 500)
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(req, ['ADMIN', 'MANAGER'])
    const { id } = await params
    await prisma.booking.delete({ where: { id } })
    return apiResponse({ message: 'Booking deleted' })
  } catch (error: any) {
    if (error.message === 'Unauthorized') return apiError('Unauthorized', 401)
    if (error.message === 'Forbidden') return apiError('Forbidden', 403)
    return apiError('Internal server error', 500)
  }
}
