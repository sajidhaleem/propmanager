import { can, permissionsFor, ROLE_DEFAULTS, ALL_FEATURES } from '@/lib/permissions'

describe('permissionsFor', () => {
  /* The fallback is what stops this feature locking everyone out on deploy:
     every existing user has an empty permissions array. */
  it('falls back to role defaults when the user has none of their own', () => {
    expect(permissionsFor('ADMIN', [])).toEqual(ROLE_DEFAULTS.ADMIN)
    expect(permissionsFor('STAFF', undefined)).toEqual(ROLE_DEFAULTS.STAFF)
    expect(permissionsFor('MANAGER', null)).toEqual(ROLE_DEFAULTS.MANAGER)
  })

  it('an explicit list replaces the role defaults entirely', () => {
    expect(permissionsFor('ADMIN', ['bookings'])).toEqual(['bookings'])
  })

  it('an unknown role gets nothing rather than everything', () => {
    expect(permissionsFor('CONTRACTOR', [])).toEqual([])
  })
})

describe('can', () => {
  it('admins get every feature by default', () => {
    for (const f of ALL_FEATURES) expect(can('ADMIN', [], f)).toBe(true)
  })

  it('staff do not get user management or settings by default', () => {
    expect(can('STAFF', [], 'users')).toBe(false)
    expect(can('STAFF', [], 'settings')).toBe(false)
    expect(can('STAFF', [], 'bookings')).toBe(true)
  })

  it('managers run operations but not user management', () => {
    expect(can('MANAGER', [], 'expenses')).toBe(true)
    expect(can('MANAGER', [], 'users')).toBe(false)
  })

  // The point of the feature: an explicit grant beats the role
  it('an explicit list can widen a staff user', () => {
    expect(can('STAFF', ['bookings', 'reports'], 'reports')).toBe(true)
  })

  it('an explicit list can narrow an admin', () => {
    expect(can('ADMIN', ['dashboard'], 'users')).toBe(false)
    expect(can('ADMIN', ['dashboard'], 'dashboard')).toBe(true)
  })

  it('guest profiles are available to every role by default', () => {
    expect(can('STAFF', [], 'guests')).toBe(true)
    expect(can('MANAGER', [], 'guests')).toBe(true)
    expect(can('ADMIN', [], 'guests')).toBe(true)
  })
})
