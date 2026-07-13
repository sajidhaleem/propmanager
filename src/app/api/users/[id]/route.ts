import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { apiError, apiResponse, handleApiError } from '@/lib/utils'
import { z } from 'zod'
import { emailField } from '@/lib/validations'

const adminUpdateSchema = z.object({
  name:     z.string().min(2).optional(),
  email:    emailField.optional(),
  role:     z.enum(['ADMIN', 'MANAGER', 'STAFF']).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8).optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(req, ['ADMIN'])
    const { id } = await params
    const body = await req.json()
    const result = adminUpdateSchema.safeParse(body)
    if (!result.success) return apiError(result.error.errors[0].message)

    const { password, ...rest } = result.data
    const updateData: any = { ...rest }
    if (password) {
      updateData.password = await bcrypt.hash(password, 12)
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: { id: true, name: true, email: true, role: true, isActive: true },
    })
    return apiResponse(user)
  } catch (error: any) {
    return handleApiError(error)
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole(req, ['ADMIN'])
    const { id } = await params
    if (session.userId === id) return apiError('Cannot delete yourself', 400)

    // Remove audit log entries first to satisfy FK constraint
    await prisma.auditLog.deleteMany({ where: { userId: id } })
    await prisma.user.delete({ where: { id } })
    return apiResponse({ message: 'User deleted' })
  } catch (error: any) {
    return handleApiError(error)
  }
}
