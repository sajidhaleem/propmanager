/**
 * Feature access.
 *
 * One permission per area of the app — access means "can open the page and use
 * its API". Deliberately not split into read/write: the ask was to hand a user
 * a feature or not, and a matrix four times this size is four times the surface
 * to get wrong.
 *
 * Deliberately free of Prisma and next/server imports so the settings screen and
 * the nav can import it too. The server-side guard lives in permissionGuard.ts.
 */
export const FEATURES = [
  { key: 'dashboard',  label: 'Dashboard' },
  { key: 'calendar',   label: 'Calendar' },
  { key: 'bookings',   label: 'Bookings' },
  { key: 'guests',     label: 'Guest profiles' },
  { key: 'properties', label: 'Properties' },
  { key: 'income',     label: 'Income' },
  { key: 'expenses',   label: 'Expenses' },
  { key: 'payouts',    label: 'Payouts' },
  { key: 'reports',    label: 'Reports' },
  { key: 'users',      label: 'User management' },
  { key: 'settings',   label: 'System settings' },
] as const

export type Feature = (typeof FEATURES)[number]['key']

export const ALL_FEATURES = FEATURES.map(f => f.key) as Feature[]

/** What a role gets when a user has no explicit permissions of their own. */
export const ROLE_DEFAULTS: Record<string, Feature[]> = {
  ADMIN: ALL_FEATURES,
  MANAGER: ['dashboard', 'calendar', 'bookings', 'guests', 'properties', 'income', 'expenses', 'payouts', 'reports'],
  STAFF: ['dashboard', 'calendar', 'bookings', 'guests'],
}

/**
 * An empty list means "fall back to the role", so every existing user keeps the
 * access they have today and nobody is locked out by deploying this.
 */
export function permissionsFor(role: string, permissions?: string[] | null): Feature[] {
  if (permissions && permissions.length > 0) return permissions as Feature[]
  return ROLE_DEFAULTS[role] ?? []
}

export function can(role: string, permissions: string[] | null | undefined, feature: Feature): boolean {
  return permissionsFor(role, permissions).includes(feature)
}
