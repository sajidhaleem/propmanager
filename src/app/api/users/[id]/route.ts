import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { apiError, apiResponse } from '@/lib/utils'
import { z } from 'zod'

const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  role: z.enum(['ADMIN', 'MANAGER', 'STAFF']).optional(),
  isActive: z.boolean().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(req, ['ADMIN'])
    const { id } = await params
    const body = await req.json()
    const result = updateUserSchema.safeParse(body)
    if (!result.success) return apiError(result.error.errors[0].message)

    const user = await prisma.user.update({
      where: { id },
      data: result.data,
      select: { id: true, name: true, email: true, role: true, isActive: true },
    })
    return apiResponse(user)
  } catch (error: any) {
    if (error.message === 'Unauthorized') return apiError('Unauthorized', 401)
    if (error.message === 'Forbidden') return apiError('Forbidden', 403)
    return apiError('Internal server error', 500)
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole(req, ['ADMIN'])
    const { id } = await params
    if (session.userId === id) return apiError('Cannot delete yourself', 400)

    await prisma.user.update({ where: { id }, data: { isActive: false } })
    return apiResponse({ message: 'User deactivated' })
  } catch (error: any) {
    if (error.message === 'Unauthorized') return apiError('Unauthorized', 401)
    if (error.message === 'Forbidden') return apiError('Forbidden', 403)
    return apiError('Internal server error', 500)
  }
}
