import type { BrowserContext } from '@playwright/test'
import { SignJWT } from 'jose'

/**
 * Signs a session cookie the middleware will accept.
 *
 * Deliberately does not log in through the form: seeded credentials drift with
 * the seed script, and a UI login makes every spec depend on the auth page
 * rendering correctly. These specs are about other screens.
 */
export async function signIn(context: BrowserContext, baseURL: string) {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET must be set to run the e2e suite')

  const token = await new SignJWT({
    userId: 'e2e-user',
    email: 'e2e@test.local',
    name: 'E2E User',
    role: 'ADMIN',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(secret))

  const { hostname, protocol } = new URL(baseURL)
  const secure = protocol === 'https:'

  await context.addCookies([
    { name: 'auth-token', value: token, domain: hostname, path: '/', httpOnly: true, secure },
    /* The middleware treats a missing last-activity cookie as an expired
       session and fails closed, so it has to be seeded alongside the token. */
    { name: 'last-activity', value: String(Date.now()), domain: hostname, path: '/', httpOnly: true, secure },
  ])
}