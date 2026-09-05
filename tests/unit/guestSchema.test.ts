import { guestSchema, blankToNull } from '@/lib/guests'

/**
 * The guest API hands back null for every field the desk left empty. Saving
 * that record straight back must work: a read the app itself produced is the
 * most ordinary thing a write will ever be given.
 *
 * It did not. `email: null` failed a string-or-empty union and surfaced as the
 * bare Zod default, "Invalid input", so editing any guest with no email address
 * was refused with a message naming neither the field nor the reason.
 */

// what GET /api/guests/[id] returns for a guest with only the basics filled in
const FROM_API = {
  name: 'Abdul Hassan',
  email: null,
  phone: '+92 309 7607230',
  cnic: '34402-2736010-9',
  fatherName: 'Riaz Ahmed',
  gender: 'Male',
  address: 'Post Office Gadhar, Laka, Tehsil Mandi Bahauddin',
  province: 'Mandi Bahauddin',
  district: 'Mandi Bahauddin',
  passportNumber: null,
  nationality: null,
  passportExpiry: null,
  notes: null,
}

describe('guestSchema', () => {
  it('accepts the record the API itself returns, nulls and all', () => {
    const parsed = guestSchema.safeParse(FROM_API)
    expect(parsed.success).toBe(true)
  })

  it('accepts it on the partial used by PATCH', () => {
    const parsed = guestSchema.partial().safeParse(FROM_API)
    expect(parsed.success).toBe(true)
  })

  it('still accepts the empty strings an untouched form sends', () => {
    const parsed = guestSchema.safeParse({ ...FROM_API, email: '', notes: '', passportNumber: '' })
    expect(parsed.success).toBe(true)
  })

  it('still rejects a name that is not a name', () => {
    const parsed = guestSchema.safeParse({ ...FROM_API, name: 'A' })
    expect(parsed.success).toBe(false)
    if (!parsed.success) expect(parsed.error.errors[0].message).toBe('Guest name is required')
  })

  /* "Invalid input" told the desk nothing: not which field, not what was wrong
     with it. Any rejection has to name the field in words. */
  it('rejects a malformed email with a message that says so', () => {
    const parsed = guestSchema.safeParse({ ...FROM_API, email: 'not-an-address' })
    expect(parsed.success).toBe(false)
    if (!parsed.success) {
      expect(parsed.error.errors[0].message).toMatch(/email/i)
      expect(parsed.error.errors[0].message).not.toBe('Invalid input')
    }
  })
})

describe('blankToNull', () => {
  it('stores an emptied field as null rather than an empty string', () => {
    expect(blankToNull({ email: '', name: 'Abdul Hassan' })).toEqual({ email: null, name: 'Abdul Hassan' })
  })

  /* Null is what the field already was. Passing it through unchanged is what
     lets a round trip through the form be a no-op instead of a failure. */
  it('leaves a null alone', () => {
    expect(blankToNull({ email: null })).toEqual({ email: null })
  })
})
