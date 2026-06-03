import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, requireRole } from '@/lib/auth'
import { propertySchema } from '@/lib/validations'
import { apiError, apiResponse } from '@/lib/utils'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(req)
    const { id } = await params
    const property = await prisma.property.findUnique({
      where: { id },
      include: {
        _count: { select: { bookings: true } },
        bookings: {
          orderBy: { checkIn: 'desc' },
          take: 10,
        },
      },
    })
    if (!property) return apiError('Property not found', 404)
    return apiResponse(property)
  } catch (error: any) {
    if (error.message === 'Unauthorized') return apiError('Unauthorized', 401)
    return apiError('Internal server error', 500)
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(req, ['ADMIN', 'MANAGER'])
    const { id } = await params
    const body = await req.json()
    const result = propertySchema.partial().safeParse(body)
    if (!result.success) return apiError(result.error.errors[0].message)

    const property = await prisma.property.update({ where: { id }, data: result.data })
    return apiResponse(property)
  } catch (error: any) {
    if (error.message === 'Unauthorized') return apiError('Unauthorized', 401)
    if (error.message === 'Forbidden') return apiError('Forbidden', 403)
    return apiError('Internal server error', 500)
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(req, ['ADMIN'])
    const { id } = await params
    await prisma.property.delete({ where: { id } })
    return apiResponse({ message: 'Property deleted' })
  } catch (error: any) {
    if (error.message === 'Unauthorized') return apiError('Unauthorized', 401)
    if (error.message === 'Forbidden') return apiError('Forbidden', 403)
    return apiError('Internal server error', 500)
  }
}
