import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'
import { signToken } from '@/lib/auth'
import { loginSchema } from '@/lib/validations'
import { apiError } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const result = loginSchema.safeParse(body)
    if (!result.success) {
      return apiError(result.error.errors[0].message, 400)
    }

    const { email, password } = result.data

    let user
    try {
      user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } })
    } catch (dbError) {
      console.error('DB error during login:', dbError)
      return apiError('Service temporarily unavailable', 503)
    }

    if (!user || !user.isActive) {
      return apiError('Invalid email or password', 401)
    }

    const isValid = await bcrypt.compare(password, user.password)
    if (!isValid) {
      return apiError('Invalid email or password', 401)
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
      secure: true,
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
