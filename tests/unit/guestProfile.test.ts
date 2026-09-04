import {
  filingChecklist, completeness, nightsByMonth, filingMix, openFiling, totalNights,
  type Stay,
} from '@/lib/guestProfile'

const HOUR = 60 * 60 * 1000
const NOW = new Date('2026-09-05T12:00:00Z')
const ago = (hours: number) => new Date(NOW.getTime() - hours * HOUR).toISOString()

const stay = (id: string, hoursAgo: number, extra: Partial<Stay> = {}): Stay => ({
  id,
  checkIn: ago(hoursAgo),
  checkOut: ago(hoursAgo - 24),
  nights: 1,
  hotelEyeStatus: 'NOT_ENTERED',
  ...extra,
})

const FULL = {
  name: 'Hamza Naeem', cnic: '35202-1234567-1', fatherName: 'Naeem Ahmed',
  gender: 'Male', address: 'House 4, Model Town', province: 'Punjab',
  district: 'Lahore', phone: '03071130001',
}

describe('filingChecklist', () => {
  it('is the eight fields the portal form asks for', () => {
    expect(filingChecklist({}, false)).toHaveLength(8)
  })

  it('passes a complete guest with a card on file', () => {
    expect(filingChecklist(FULL, true).every(i => i.done)).toBe(true)
  })

  // the desk should not be told to scan a CNIC for a foreign guest
  it('accepts a passport in place of a CNIC', () => {
    const items = filingChecklist({ passportNumber: 'AB1234567' }, false)
    expect(items.find(i => i.key === 'document')!.done).toBe(true)
  })

  it('will not call province and district done when only one is recorded', () => {
    const items = filingChecklist({ province: 'Punjab' }, false)
    expect(items.find(i => i.key === 'region')!.done).toBe(false)
  })

  it('treats whitespace as missing rather than as a value', () => {
    const items = filingChecklist({ fatherName: '   ' }, false)
    expect(items.find(i => i.key === 'father')!.done).toBe(false)
  })
})

describe('completeness', () => {
  it('reports 100% for a guest who can actually be filed', () => {
    expect(completeness(FULL, true).overall).toBe(100)
  })

  /* Overall is the filing checklist, not the average of the three bars: a
     guest with a perfect travel section can still be unfilable. */
  it('does not let a full travel section imply a filable guest', () => {
    const c = completeness(
      { name: 'A Visitor', passportNumber: 'AB1234567', nationality: 'British', passportExpiry: '2030-01-01' },
      false,
    )
    expect(c.travel).toBe(100)
    expect(c.overall).toBeLessThan(100)
  })

  it('counts the checklist rather than guessing', () => {
    const c = completeness(FULL, true)
    expect(c.done).toBe(c.total)
    expect(c.total).toBe(8)
  })
})

describe('nightsByMonth', () => {
  it('ends on the current month and runs back the requested span', () => {
    const chart = nightsByMonth([], 7, NOW)
    expect(chart).toHaveLength(7)
    expect(chart[6].date.getMonth()).toBe(NOW.getMonth())
    expect(chart[0].date.getMonth()).toBe(new Date(NOW.getFullYear(), NOW.getMonth() - 6, 1).getMonth())
  })

  it('adds up the nights that land in each month', () => {
    const chart = nightsByMonth([stay('a', 2, { nights: 3 }), stay('b', 5, { nights: 2 })], 7, NOW)
    expect(chart[6].nights).toBe(5)
  })

  // an old stay must not be folded into the first bucket it can reach
  it('drops stays older than the window instead of piling them on the oldest bar', () => {
    const chart = nightsByMonth([stay('old', 24 * 400, { nights: 9 })], 7, NOW)
    expect(chart.reduce((n, c) => n + c.nights, 0)).toBe(0)
  })

  it('counts a stay with no recorded nights as one', () => {
    const chart = nightsByMonth([stay('a', 2, { nights: undefined })], 7, NOW)
    expect(chart[6].nights).toBe(1)
  })
})

describe('filingMix', () => {
  it('is all zeroes rather than NaN for a guest with no stays', () => {
    const mix = filingMix([], NOW)
    expect(mix.total).toBe(0)
    expect(mix.filed).toBe(0)
  })

  /* Overdue is split out of "not filed" deliberately: they are the same column
     in the database and completely different situations in law. */
  it('separates a stay past the window from one still inside it', () => {
    const mix = filingMix([stay('late', 30), stay('fresh', 2)], NOW)
    expect(mix.counts.overdue).toBe(1)
    expect(mix.counts.unfiled).toBe(1)
  })

  it('counts a failed filing as exposure, not as merely unfiled', () => {
    const mix = filingMix([stay('f', 2, { hotelEyeStatus: 'FAILED' })], NOW)
    expect(mix.counts.overdue).toBe(1)
  })

  it('reads a filed stay as filed even when it was filed late', () => {
    const mix = filingMix([stay('late', 40, { hotelEyeStatus: 'ENTERED', hotelEyeFiledAt: ago(2) })], NOW)
    expect(mix.filed).toBe(100)
  })
})

describe('openFiling', () => {
  it('is null when every stay is on the portal', () => {
    expect(openFiling([stay('a', 5, { hotelEyeStatus: 'ENTERED' })], NOW)).toBeNull()
  })

  // the newest arrival is the one whose clock is still running
  it('picks the most recent unfiled arrival', () => {
    const open = openFiling([stay('older', 40), stay('newer', 3)], NOW)
    expect(open!.stay.id).toBe('newer')
  })

  it('still reports an arrival whose window has already closed', () => {
    const open = openFiling([stay('late', 50)], NOW)
    expect(open!.status.state).toBe('OVERDUE')
    expect(open!.status.hoursRemaining).toBeLessThan(0)
  })
})

describe('totalNights', () => {
  it('adds the recorded nights and counts a blank as one', () => {
    expect(totalNights([stay('a', 1, { nights: 3 }), stay('b', 2, { nights: undefined })])).toBe(4)
  })
})
