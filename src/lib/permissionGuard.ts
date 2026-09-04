import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { can, type Feature } from '@/lib/permissions'

/**
 * Route guard for a feature.
 *
 * Reads the user's current row rather than trusting the JWT: revoking someone's
 * access has to take effect on their next request, not whenever a seven-day
 * token happens to expire. Hiding a nav link is a courtesy — this is the control.
 *
 * Separate from permissions.ts because that module is imported by client
 * components, and Prisma cannot follow it into the browser bundle.
 */
export async function requirePermission(req: NextRequest, feature: Feature) {
  const session = await requireAuth(req)
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true, permissions: true, isActive: true },
  })
  if (!user || !user.isActive) throw new Error('Unauthorized')
  if (!can(user.role, user.permissions, feature)) throw new Error('Forbidden')
  return session
}
