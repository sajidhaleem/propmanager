import {
  normalizeCnic, normalizePassport, normalizeGuestIdentity, guestSearchVariants,
} from '@/lib/guests'

/**
 * One person, one profile.
 *
 * The unique index compares stored strings, so these functions are what makes
 * it work: without them the same national identity card typed three ways is
 * three guests, and the desk never sees the stay history it was looking for.
 */

describe('normalizeCnic', () => {
  const CANONICAL = '35202-1234567-1'

  it('reads every way a desk types the same card as one number', () => {
    expect(normalizeCnic('35202-1234567-1')).toBe(CANONICAL)
    expect(normalizeCnic('3520212345671')).toBe(CANONICAL)
    expect(normalizeCnic('35202 1234567 1')).toBe(CANONICAL)
    expect(normalizeCnic('  35202–1234567–1  '.replace(/–/g, '-'))).toBe(CANONICAL)
    expect(normalizeCnic('35202.1234567.1')).toBe(CANONICAL)
  })

  it('treats an empty value as no CNIC, not as a blank one', () => {
    // '' would defeat the unique index — the second blank collides with the first
    expect(normalizeCnic('')).toBeNull()
    expect(normalizeCnic('   ')).toBeNull()
    expect(normalizeCnic(null)).toBeNull()
    expect(normalizeCnic(undefined)).toBeNull()
  })

  /* A half-typed or foreign number is stored as given. Reshaping it would make
     something that is not a CNIC look like a valid one. */
  it('leaves anything that is not thirteen digits alone', () => {
    expect(normalizeCnic('35202-12345')).toBe('35202-12345')
    expect(normalizeCnic('352021234567')).toBe('352021234567')
    expect(normalizeCnic('35202123456789')).toBe('35202123456789')
    expect(normalizeCnic('not a number')).toBe('not a number')
  })

  it('is idempotent, so the backfill can be re-run', () => {
    expect(normalizeCnic(normalizeCnic('3520212345671'))).toBe(CANONICAL)
  })
})

describe('normalizePassport', () => {
  it('reads case and spacing as noise, not as a different document', () => {
    expect(normalizePassport('AB1234567')).toBe('AB1234567')
    expect(normalizePassport('ab1234567')).toBe('AB1234567')
    expect(normalizePassport('AB 1234567')).toBe('AB1234567')
    expect(normalizePassport(' ab-123 4567 ')).toBe('AB1234567')
  })

  it('treats an empty value as no passport', () => {
    expect(normalizePassport('')).toBeNull()
    expect(normalizePassport('  ')).toBeNull()
    expect(normalizePassport(null)).toBeNull()
  })

  it('is idempotent', () => {
    expect(normalizePassport(normalizePassport('ab 1234567'))).toBe('AB1234567')
  })
})

describe('normalizeGuestIdentity', () => {
  it('canonicalises both identifiers and leaves everything else untouched', () => {
    expect(normalizeGuestIdentity({
      name: 'Hamza Naeem',
      cnic: '3520212345671',
      passportNumber: 'ab 1234567',
      phone: '0307 113 0001',
    })).toEqual({
      name: 'Hamza Naeem',
      cnic: '35202-1234567-1',
      passportNumber: 'AB1234567',
      phone: '0307 113 0001',
    })
  })

  /* A partial edit must not write null over a field it never mentioned — that
     would clear a CNIC every time someone changed a phone number. */
  it('ignores identifiers the caller did not send', () => {
    const patch = { phone: '03001234567' }
    expect(normalizeGuestIdentity(patch)).toEqual(patch)
    expect('cnic' in normalizeGuestIdentity(patch)).toBe(false)
  })

  it('turns a blank identifier into null rather than an empty string', () => {
    expect(normalizeGuestIdentity({ cnic: '', passportNumber: '  ' }))
      .toEqual({ cnic: null, passportNumber: null })
  })
})

describe('guestSearchVariants', () => {
  /* The search that misses is what creates the duplicate: nothing comes back,
     so the desk makes a second profile for someone already on file. */
  it('finds a stored, dashed CNIC from the digits alone', () => {
    expect(guestSearchVariants('3520212345671')).toContain('35202-1234567-1')
  })

  it('finds a digits-only stored CNIC from the dashed form', () => {
    expect(guestSearchVariants('35202-1234567-1')).toContain('3520212345671')
  })

  it('finds a passport whatever case it was typed in', () => {
    expect(guestSearchVariants('ab1234567')).toContain('AB1234567')
  })

  it('always keeps the term as typed, so name search still works', () => {
    expect(guestSearchVariants('Hamza')).toContain('Hamza')
  })

  it('has nothing to search for on an empty term', () => {
    expect(guestSearchVariants('')).toEqual([])
    expect(guestSearchVariants('   ')).toEqual([])
    expect(guestSearchVariants(null)).toEqual([])
  })

  it('does not repeat a term that is already canonical', () => {
    const v = guestSearchVariants('35202-1234567-1')
    expect(new Set(v).size).toBe(v.length)
  })
})
