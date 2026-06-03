import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'default-secret-change-in-production'
)

export interface JWTPayload {
  userId: string
  email: string
  name: string
  role: string
  iat?: number
  exp?: number
}

export async function signToken(payload: Omit<JWTPayload, 'iat' | 'exp'>) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET)
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as unknown as JWTPayload
  } catch {
    return null
  }
}

export async function getSession(): Promise<JWTPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')?.value
  if (!token) return null
  return verifyToken(token)
}

export async function getSessionFromRequest(req: NextRequest): Promise<JWTPayload | null> {
  const token = req.cookies.get('auth-token')?.value
  if (!token) return null
  return verifyToken(token)
}

export async function requireAuth(req: NextRequest): Promise<JWTPayload> {
  const session = await getSessionFromRequest(req)
  if (!session) {
    throw new Error('Unauthorized')
  }
  return session
}

export async function requireRole(req: NextRequest, roles: string[]): Promise<JWTPayload> {
  const session = await requireAuth(req)
  if (!roles.includes(session.role)) {
    throw new Error('Forbidden')
  }
  return session
}
