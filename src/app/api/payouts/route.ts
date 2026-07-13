import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, requireRole } from '@/lib/auth'
import { payoutSchema } from '@/lib/validations'
import { apiError, apiResponse, handleApiError } from '@/lib/utils'

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req)
    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : undefined
    const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : undefined
    const status = searchParams.get('status')
    const search = searchParams.get('search')

    const where: any = {}
    if (year) where.year = year
    if (month) where.month = month
    if (status) where.status = status
    if (search) where.recipientName = { contains: search, mode: 'insensitive' }

    const sortBy    = searchParams.get('sortBy')    || 'date'
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc'

    const [payouts, total, aggregate, pendingAgg, paidAgg] = await Promise.all([
      prisma.payout.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.payout.count({ where }),
      prisma.payout.aggregate({ _sum: { amount: true }, where }),
      prisma.payout.aggregate({ _sum: { amount: true }, where: { ...where, status: 'PENDING' } }),
      prisma.payout.aggregate({ _sum: { amount: true }, where: { ...where, status: 'PAID'    } }),
    ])

    return apiResponse({
      data: payouts,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      summary: {
        totalAmount:   aggregate._sum.amount   || 0,
        pendingAmount: pendingAgg._sum.amount  || 0,
        paidAmount:    paidAgg._sum.amount     || 0,
      },
    })
  } catch (error: any) {
    return handleApiError(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireRole(req, ['ADMIN', 'MANAGER'])
    const body = await req.json()
    const result = payoutSchema.safeParse(body)
    if (!result.success) return apiError(result.error.errors[0].message)

    const date = new Date(result.data.date)
    if (isNaN(date.getTime())) return apiError('Invalid date')
    const payout = await prisma.payout.create({
      data: {
        ...result.data,
        date,
        month: date.getMonth() + 1,
        year: date.getFullYear(),
      },
    })
    return apiResponse(payout, 201)
  } catch (error: any) {
    return handleApiError(error)
  }
}
