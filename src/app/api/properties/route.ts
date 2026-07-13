import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, requireRole } from '@/lib/auth'
import { propertySchema } from '@/lib/validations'
import { apiError, apiResponse, handleApiError } from '@/lib/utils'

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req)
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const search = searchParams.get('search')

    const where: any = {}
    if (status) where.status = status
    if (search) where.name = { contains: search, mode: 'insensitive' }

    const properties = await prisma.property.findMany({
      where,
      include: {
        _count: { select: { bookings: true } },
      },
      orderBy: { name: 'asc' },
    })

    return apiResponse(properties)
  } catch (error: any) {
    return handleApiError(error)
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireRole(req, ['ADMIN', 'MANAGER'])
    const body = await req.json()
    const result = propertySchema.safeParse(body)
    if (!result.success) return apiError(result.error.errors[0].message)

    const property = await prisma.property.create({ data: result.data })
    return apiResponse(property, 201)
  } catch (error: any) {
    return handleApiError(error)
  }
}
