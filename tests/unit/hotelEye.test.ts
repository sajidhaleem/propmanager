import {
  filingDeadline, getFilingStatus, formatSpan, dailyComplianceSummary,
  FILING_WINDOW_HOURS, DUE_SOON_HOURS,
} from '@/lib/hotelEye'

const HOUR = 60 * 60 * 1000
const at = (base: Date, hours: number) => new Date(base.getTime() + hours * HOUR)

const CHECK_IN = new Date('2026-08-20T14:00:00.000Z')

describe('filingDeadline', () => {
  it('is 24 hours after check-in', () => {
    expect(filingDeadline(CHECK_IN).toISOString()).toBe('2026-08-21T14:00:00.000Z')
    expect(FILING_WINDOW_HOURS).toBe(24)
  })

  it('accepts an ISO string', () => {
    expect(filingDeadline(CHECK_IN.toISOString()).getTime()).toBe(filingDeadline(CHECK_IN).getTime())
  })
})

describe('getFilingStatus', () => {
  const unfiled = { checkIn: CHECK_IN, hotelEyeStatus: 'NOT_ENTERED' }

  it('is PENDING while there is plenty of the window left', () => {
    const s = getFilingStatus(unfiled, at(CHECK_IN, 1))
    expect(s.state).toBe('PENDING')
    expect(Math.round(s.hoursRemaining)).toBe(23)
  })

  it('becomes DUE_SOON inside the final window', () => {
    expect(getFilingStatus(unfiled, at(CHECK_IN, 24 - DUE_SOON_HOURS + 0.5)).state).toBe('DUE_SOON')
  })

  it('becomes OVERDUE once 24 hours have passed', () => {
    const s = getFilingStatus(unfiled, at(CHECK_IN, 27))
    expect(s.state).toBe('OVERDUE')
    expect(s.hoursRemaining).toBeCloseTo(-3)
    expect(s.label).toBe('Overdue 3h')
  })

  it('treats the deadline itself as overdue, not as time remaining', () => {
    expect(getFilingStatus(unfiled, at(CHECK_IN, 24)).state).toBe('OVERDUE')
  })

  it('reports FILED regardless of how late it was entered', () => {
    // a late entry is still an entry; showing it as overdue would misstate the record
    const s = getFilingStatus({ ...unfiled, hotelEyeStatus: 'ENTERED' }, at(CHECK_IN, 100))
    expect(s.state).toBe('FILED')
  })

  it('reports FILED when only a filed timestamp is present', () => {
    const s = getFilingStatus({ checkIn: CHECK_IN, hotelEyeFiledAt: at(CHECK_IN, 2) }, at(CHECK_IN, 50))
    expect(s.state).toBe('FILED')
  })

  it('surfaces FAILED rather than hiding it as merely unfiled', () => {
    expect(getFilingStatus({ ...unfiled, hotelEyeStatus: 'FAILED' }, at(CHECK_IN, 1)).state).toBe('FAILED')
  })

  it('lets OVERDUE outrank QUEUED — time is up either way', () => {
    expect(getFilingStatus({ ...unfiled, hotelEyeStatus: 'QUEUED' }, at(CHECK_IN, 30)).state).toBe('OVERDUE')
    expect(getFilingStatus({ ...unfiled, hotelEyeStatus: 'QUEUED' }, at(CHECK_IN, 2)).state).toBe('QUEUED')
  })
})

describe('formatSpan', () => {
  it('uses minutes below an hour', () => {
    expect(formatSpan(0.5)).toBe('30m')
  })

  it('never shows a zero span', () => {
    expect(formatSpan(0)).toBe('1m')
    expect(formatSpan(-5)).toBe('1m')
  })

  it('uses hours up to two days, then days', () => {
    expect(formatSpan(5)).toBe('5h')
    expect(formatSpan(47)).toBe('47h')
    expect(formatSpan(72)).toBe('3d')
  })
})

describe('dailyComplianceSummary', () => {
  /* Local dates on purpose: "today's arrivals" is the operator's calendar day
     in Lahore, not a UTC day, and building these as UTC instants would make
     the test pass or fail depending on the machine's timezone. */
  const day = new Date(2026, 7, 20, 23, 0)
  const sameDay = (h: number) => new Date(2026, 7, 20, h, 0)
  const dayBefore = new Date(2026, 7, 19, 14, 0)

  it('counts only arrivals on that day', () => {
    const s = dailyComplianceSummary([
      { checkIn: sameDay(9),  hotelEyeStatus: 'ENTERED' },
      { checkIn: sameDay(14), hotelEyeStatus: 'ENTERED' },
      { checkIn: dayBefore, hotelEyeStatus: 'NOT_ENTERED' },
    ], day)
    expect(s.total).toBe(2)
    expect(s.filed).toBe(2)
    expect(s.clear).toBe(true)
  })

  it('is not clear while an arrival is unfiled', () => {
    const s = dailyComplianceSummary([
      { checkIn: sameDay(9),  hotelEyeStatus: 'ENTERED' },
      { checkIn: sameDay(14), hotelEyeStatus: 'NOT_ENTERED' },
    ], day)
    expect(s).toMatchObject({ total: 2, filed: 1, clear: false })
  })

  it('is not clear when there were no arrivals — there is nothing to prove', () => {
    expect(dailyComplianceSummary([], day).clear).toBe(false)
  })
})
