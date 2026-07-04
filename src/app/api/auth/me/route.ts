import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { getSessionFromRequest, signToken } from '@/lib/auth'
import { apiError, apiResponse } from '@/lib/utils'
import { z } from 'zod'
import { emailField } from '@/lib/validations'

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req)
  if (!session) return apiError('Unauthorized', 401)
  return apiResponse(session)
}

const selfUpdateSchema = z.object({
  name:            z.string().min(2).optional(),
  email:           emailField.optional(),
  currentPassword: z.string().optional(),
  newPassword:     z.string().min(8).optional(),
})

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req)
    if (!session) return apiError('Unauthorized', 401)

    const body = await req.json()
    const result = selfUpdateSchema.safeParse(body)
    if (!result.success) return apiError(result.error.errors[0].message)

    const { currentPassword, newPassword, ...rest } = result.data
    const updateData: any = { ...rest }

    if (newPassword) {
      if (!currentPassword) return apiError('Current password is required', 400)
      const user = await prisma.user.findUnique({ where: { id: session.userId } })
      if (!user) return apiError('User not found', 404)
      const valid = await bcrypt.compare(currentPassword, user.password)
      if (!valid) return apiError('Current password is incorrect', 400)
      updateData.password = await bcrypt.hash(newPassword, 12)
    }

    if (Object.keys(updateData).length === 0) return apiError('No changes provided', 400)

    // Check email uniqueness if changing email
    if (updateData.email && updateData.email !== session.email) {
      const existing = await prisma.user.findUnique({ where: { email: updateData.email } })
      if (existing) return apiError('Email already in use', 409)
    }

    const updated = await prisma.user.update({
      where: { id: session.userId },
      data: updateData,
      select: { id: true, name: true, email: true, role: true },
    })

    // Re-issue JWT so the cookie reflects the new name/email immediately
    const token = await signToken({
      userId: updated.id,
      email:  updated.email,
      name:   updated.name,
      role:   updated.role,
    })

    const response = NextResponse.json({ success: true, data: { name: updated.name, email: updated.email } })
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure:   true,
      sameSite: 'lax',
      maxAge:   60 * 60 * 24 * 7,
      path:     '/',
    })
    return response
  } catch (error: any) {
    return apiError('Internal server error', 500)
  }
}
