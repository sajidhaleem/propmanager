import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { registerSchema } from '@/lib/validations'
import { apiError, apiResponse } from '@/lib/utils'

export async function POST(req: NextRequest) {
  try {
    const session = await requireRole(req, ['ADMIN'])
    const body = await req.json()
    const result = registerSchema.safeParse(body)
    if (!result.success) {
      return apiError(result.error.errors[0].message, 400)
    }

    const { name, email, password, role } = result.data
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) return apiError('Email already in use', 409)

    const hashedPassword = await bcrypt.hash(password, 12)
    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword, role },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    })

    return apiResponse(user, 201)
  } catch (error: any) {
    if (error.message === 'Unauthorized') return apiError('Unauthorized', 401)
    if (error.message === 'Forbidden') return apiError('Forbidden', 403)
    return apiError('Internal server error', 500)
  }
}
