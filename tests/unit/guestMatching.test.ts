import { normalizePhone, normalizeName, sameGuest } from '@/lib/guests'

describe('normalizePhone', () => {
  // the same number as three people at the desk would type it
  it('treats the local, national and international spellings as one number', () => {
    const forms = ['0307 113 0001', '+92 307 1130001', '03071130001', '92-307-1130001']
    const normalized = new Set(forms.map(normalizePhone))
    expect(normalized.size).toBe(1)
  })

  it('is empty for a missing number rather than throwing', () => {
    expect(normalizePhone(null)).toBe('')
    expect(normalizePhone('')).toBe('')
    expect(normalizePhone('   ')).toBe('')
  })
})

describe('normalizeName', () => {
  it('collapses case and stray spacing', () => {
    expect(normalizeName('  Hamza   Naeem ')).toBe('hamza naeem')
    expect(normalizeName('HAMZA NAEEM')).toBe(normalizeName('hamza naeem'))
  })
})

describe('sameGuest', () => {
  it('matches the same name and number however each was typed', () => {
    expect(sameGuest({ name: 'Hamza Naeem', phone: '03071130001' },
                     { name: 'hamza  naeem', phone: '+92 307 113 0001' })).toBe(true)
  })

  /* Production had one guest across 11 bookings where only one stay carried the
     number — treating blank as a different person is how that becomes 11 profiles. */
  it('folds a stay with no number into the profile that has one', () => {
    expect(sameGuest({ name: 'Hamza Naeem', phone: null },
                     { name: 'Hamza Naeem', phone: '03071130001' })).toBe(true)
  })

  it('keeps two different numbers apart, same name or not', () => {
    expect(sameGuest({ name: 'Ahmed Khan', phone: '03001112222' },
                     { name: 'Ahmed Khan', phone: '03003334444' })).toBe(false)
  })

  it('never matches on the number alone', () => {
    expect(sameGuest({ name: 'Ali', phone: '03001112222' },
                     { name: 'Bilal', phone: '03001112222' })).toBe(false)
  })

  it('refuses to match when there is no name to match on', () => {
    expect(sameGuest({ name: '', phone: '03001112222' },
                     { name: '', phone: '03001112222' })).toBe(false)
  })
})
