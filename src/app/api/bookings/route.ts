import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, requireRole } from '@/lib/auth'
import { bookingSchema } from '@/lib/validations'
import { apiError, apiResponse } from '@/lib/utils'
import { differenceInDays } from 'date-fns'

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req)
    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search')
    const status = searchParams.get('status')
    const platform = searchParams.get('platform')
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
    if (error.message === 'Unauthorized') return apiError('Unauthorized', 401)
    return apiError('Internal server error', 500)
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

    const nights = Math.max(1, differenceInDays(checkOut, checkIn))
    const miscCharges = (data as any).miscCharges ?? 0
    const totalAmount = data.rate * nights + data.cleaningFee + miscCharges
    const netAmount = totalAmount - data.platformFee

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
        miscCharges,
        miscDescription: (data as any).miscDescription ?? null,
      },
      include: { property: { select: { id: true, name: true } } },
    })

    return apiResponse(booking, 201)
  } catch (error: any) {
    if (error.message === 'Unauthorized') return apiError('Unauthorized', 401)
    if (error.message === 'Forbidden') return apiError('Forbidden', 403)
    return apiError('Internal server error', 500)
  }
}
