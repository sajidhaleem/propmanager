import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, requireRole } from '@/lib/auth'
import { bookingSchema } from '@/lib/validations'
import { apiError, apiResponse, handleApiError } from '@/lib/utils'
import { differenceInCalendarDays } from 'date-fns'

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req)
    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search')
    const status = searchParams.get('status')
    const platform = searchParams.get('platform')
    const hotelEyeStatus = searchParams.get('hotelEyeStatus')
    const propertyId = searchParams.get('propertyId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const sortBy = searchParams.get('sortBy') || 'checkIn'
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc'

    const where: any = {}
    if (search) {
      where.OR = [
        { guestName: { contains: search, mode: 'insensitive' } },
        { guestEmail: { contains: search, mode: 'insensitive' } },
      ]
    }
    if (status) where.status = status
    if (platform) where.platform = platform
    if (hotelEyeStatus) where.hotelEyeStatus = hotelEyeStatus
    if (propertyId) where.propertyId = propertyId
    if (startDate && endDate) {
      // Overlap: booking overlaps with [startDate, endDate] window
      where.AND = [
        { checkIn:  { lte: new Date(endDate) } },
        { checkOut: { gte: new Date(startDate) } },
      ]
    } else if (startDate) {
      where.checkIn = { gte: new Date(startDate) }
    } else if (endDate) {
      where.checkIn = { lte: new Date(endDate) }
    }

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: { property: { select: { id: true, name: true } } },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.booking.count({ where }),
    ])

    return apiResponse({
      data: bookings,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error: any) {
    return handleApiError(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireRole(req, ['ADMIN', 'MANAGER', 'STAFF'])
    const body = await req.json()
    const result = bookingSchema.safeParse(body)
    if (!result.success) return apiError(result.error.errors[0].message)

    const data = result.data
    const checkIn = new Date(data.checkIn)
    const checkOut = new Date(data.checkOut)

    if (checkOut <= checkIn) return apiError('Check-out must be after check-in')

    const nights = Math.max(1, differenceInCalendarDays(checkOut, checkIn))
    const miscCharges = data.miscCharges
    const totalAmount = data.rate * nights + data.cleaningFee + miscCharges
    const netAmount = totalAmount - data.platformFee
    const paidAmount = data.paidAmount

    // Conflict check
    const conflict = await prisma.booking.findFirst({
      where: {
        propertyId: data.propertyId,
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        OR: [
          { checkIn: { lt: checkOut }, checkOut: { gt: checkIn } },
        ],
      },
    })
    if (conflict) return apiError('Property is already booked for these dates', 409)

    const booking = await prisma.booking.create({
      data: {
        ...data,
        checkIn,
        checkOut,
        nights,
        totalAmount,
        netAmount,
        paidAmount,
        miscCharges,
        miscDescription: data.miscDescription ?? null,
      },
      include: { property: { select: { id: true, name: true } } },
    })

    // Bookings logged retroactively as already checked out need their income
    // record too (normally created on the CHECKED_OUT status transition)
    if (booking.status === 'CHECKED_OUT') {
      await prisma.income.create({
        data: {
          bookingId: booking.id,
          grossAmount: booking.totalAmount,
          platformFee: booking.platformFee,
          cleaningFee: booking.cleaningFee,
          netAmount: booking.netAmount,
          receivedAt: booking.checkOut,
          month: booking.checkOut.getMonth() + 1,
          year: booking.checkOut.getFullYear(),
        },
      })
    }

    return apiResponse(booking, 201)
  } catch (error: any) {
    return handleApiError(error)
  }
}
