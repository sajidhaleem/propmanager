import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, requireRole } from '@/lib/auth'
import { expenseSchema } from '@/lib/validations'
import { apiError, apiResponse, handleApiError } from '@/lib/utils'
import { EXPENSE_LIST_SELECT, normalizeSubcategory } from '@/lib/expense'

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req)
    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : undefined
    const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : undefined
    const category = searchParams.get('category')
    const subcategory = searchParams.get('subcategory')
    const search = searchParams.get('search')

    const where: any = {}
    if (year) where.year = year
    if (month) where.month = month
    if (category) where.category = category
    if (subcategory) where.subcategory = subcategory
    if (search) {
      where.OR = [
        { description: { contains: search, mode: 'insensitive' } },
        { vendor: { contains: search, mode: 'insensitive' } },
      ]
    }

    const sortBy    = searchParams.get('sortBy')    || 'date'
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc'

    const [expenses, total, aggregate] = await Promise.all([
      prisma.expense.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
        select: EXPENSE_LIST_SELECT,
      }),
      prisma.expense.count({ where }),
      prisma.expense.aggregate({
        _sum: { amount: true, paidAmount: true },
        where,
      }),
    ])

    const byCategory = await prisma.expense.groupBy({
      by: ['category'],
      _sum: { amount: true },
      where,
    })

    return apiResponse({
      data: expenses,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      summary: {
        totalAmount: aggregate._sum.amount || 0,
        paidAmount: aggregate._sum.paidAmount || 0,
        outstandingAmount: Math.max(0, (aggregate._sum.amount || 0) - (aggregate._sum.paidAmount || 0)),
        byCategory,
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
    const result = expenseSchema.safeParse(body)
    if (!result.success) return apiError(result.error.errors[0].message)

    const date = new Date(result.data.date)
    if (isNaN(date.getTime())) return apiError('Invalid date')
    const { removeReceipt: _removeReceipt, ...data } = result.data
    const expense = await prisma.expense.create({
      data: {
        ...data,
        // A new expense is assumed fully paid unless the form says otherwise —
        // preserves the old single-Amount-field behavior for any caller that
        // doesn't send paidAmount.
        paidAmount: data.paidAmount ?? data.amount,
        subcategory: normalizeSubcategory(data.category, data.subcategory),
        date,
        month: date.getMonth() + 1,
        year: date.getFullYear(),
      },
      select: EXPENSE_LIST_SELECT,
    })
    return apiResponse(expense, 201)
  } catch (error: any) {
    return handleApiError(error)
  }
}
