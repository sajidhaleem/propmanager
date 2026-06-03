import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { signToken } from '@/lib/auth'
import { loginSchema } from '@/lib/validations'
import { apiError } from '@/lib/utils'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const result = loginSchema.safeParse(body)
    if (!result.success) {
      return apiError(result.error.errors[0].message, 400)
    }

    const { email, password } = result.data
    const user = await prisma.user.findUnique({ where: { email } })

    if (!user || !user.isActive) {
      return apiError('Invalid credentials', 401)
    }

    const isValid = await bcrypt.compare(password, user.password)
    if (!isValid) {
      return apiError('Invalid credentials', 401)
    }

    const token = await signToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    })

    const response = NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          avatar: user.avatar,
        },
      },
    })

    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })

    return response
  } catch (error) {
    console.error('Login error:', error)
    return apiError('Internal server error', 500)
  }
}
