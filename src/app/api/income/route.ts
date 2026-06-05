import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { apiError, apiResponse } from '@/lib/utils'

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req)
    const { searchParams } = new URL(req.url)
    const page       = parseInt(searchParams.get('page')  || '1')
    const limit      = parseInt(searchParams.get('limit') || '20')
    const year       = searchParams.get('year')       ? parseInt(searchParams.get('year')!)       : undefined
    const month      = searchParams.get('month')      ? parseInt(searchParams.get('month')!)      : undefined
    const propertyId = searchParams.get('propertyId') || undefined

    const sortBy    = searchParams.get('sortBy')    || 'receivedAt'
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc'

    const where: any = {}
    if (year)       where.year  = year
    if (month)      where.month = month
    if (propertyId) where.booking = { propertyId }

    const RELATIONAL: Record<string, any> = {
      guestName:    { booking: { guestName: sortOrder } },
      propertyName: { booking: { property: { name: sortOrder } } },
    }
    const orderBy = RELATIONAL[sortBy] ?? { [sortBy]: sortOrder }

    const [income, total, aggregate] = await Promise.all([
      prisma.income.findMany({
        where,
        include: {
          booking: {
            include: { property: { select: { id: true, name: true } } },
          },
        },
        orderBy,
        skip:  (page - 1) * limit,
        take:  limit,
      }),
      prisma.income.count({ where }),
      prisma.income.aggregate({
        _sum: { grossAmount: true, netAmount: true, platformFee: true, cleaningFee: true },
        where,
      }),
    ])

    return apiResponse({
      data: income,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      summary: {
        grossAmount:  aggregate._sum.grossAmount  || 0,
        netAmount:    aggregate._sum.netAmount    || 0,
        platformFee:  aggregate._sum.platformFee  || 0,
        cleaningFee:  aggregate._sum.cleaningFee  || 0,
      },
    })
  } catch (error: any) {
    if (error.message === 'Unauthorized') return apiError('Unauthorized', 401)
    return apiError('Internal server error', 500)
  }
}
