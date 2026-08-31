/**
 * Hotel Eye filing deadlines.
 *
 * The Punjab Information of Temporary Residence Act 2015 requires every guest
 * to be entered within 24 hours of arrival. Failing to do so carries up to six
 * months' imprisonment and a fine to PKR 100,000 — so "not filed yet" and "not
 * filed and out of time" are completely different situations and the app has
 * to tell them apart.
 */

export const FILING_WINDOW_HOURS = 24
/** Inside this much of the deadline a booking is called out as due soon. */
export const DUE_SOON_HOURS = 6

const HOUR = 60 * 60 * 1000

export type FilingState =
  | 'FILED'      // accepted by the portal
  | 'FAILED'     // the worker tried and the portal rejected it
  | 'OVERDUE'    // past 24h and still not filed — the legal exposure
  | 'DUE_SOON'   // unfiled with little of the window left
  | 'QUEUED'     // handed to the filing worker, not yet confirmed
  | 'PENDING'    // unfiled, comfortably inside the window

export interface FilingStatus {
  state: FilingState
  deadline: Date
  /** Negative once the deadline has passed. */
  hoursRemaining: number
  /** Short human label, e.g. "Due in 5h" or "Overdue 3h". */
  label: string
}

export function filingDeadline(checkIn: Date | string): Date {
  return new Date(new Date(checkIn).getTime() + FILING_WINDOW_HOURS * HOUR)
}

/**
 * `now` is injected rather than read from the clock so the result is
 * deterministic in tests and can be computed for a past day.
 */
export function getFilingStatus(
  booking: {
    checkIn: Date | string
    hotelEyeStatus?: string | null
    hotelEyeFiledAt?: Date | string | null
  },
  now: Date = new Date()
): FilingStatus {
  const deadline = filingDeadline(booking.checkIn)
  const hoursRemaining = (deadline.getTime() - now.getTime()) / HOUR

  const base = { deadline, hoursRemaining }
  const status = booking.hotelEyeStatus ?? 'NOT_ENTERED'

  /* Filed wins over the clock: a booking entered late is still entered, and
     showing it as overdue afterwards would misrepresent the record. */
  if (status === 'ENTERED' || booking.hotelEyeFiledAt) {
    return { ...base, state: 'FILED', label: 'Filed' }
  }
  if (status === 'FAILED') {
    return { ...base, state: 'FAILED', label: 'Failed' }
  }

  if (hoursRemaining <= 0) {
    return { ...base, state: 'OVERDUE', label: `Overdue ${formatSpan(-hoursRemaining)}` }
  }
  if (status === 'QUEUED') {
    return { ...base, state: 'QUEUED', label: 'Filing…' }
  }
  if (hoursRemaining <= DUE_SOON_HOURS) {
    return { ...base, state: 'DUE_SOON', label: `Due in ${formatSpan(hoursRemaining)}` }
  }
  return { ...base, state: 'PENDING', label: `Due in ${formatSpan(hoursRemaining)}` }
}

/** Compact span for a badge: minutes under an hour, then hours, then days. */
export function formatSpan(hours: number): string {
  const h = Math.max(0, hours)
  if (h < 1) return `${Math.max(1, Math.round(h * 60))}m`
  if (h < 48) return `${Math.round(h)}h`
  return `${Math.round(h / 24)}d`
}

/** Bookings needing attention, most urgent first — overdue before due-soon. */
export const NEEDS_ATTENTION: FilingState[] = ['OVERDUE', 'FAILED', 'DUE_SOON']

export function isUnfiled(state: FilingState): boolean {
  return state !== 'FILED'
}

/**
 * Compliance for a single day: how many of the guests who arrived that day
 * have been filed. This is the "3 / 3 FILED" line on a filing receipt.
 */
export function dailyComplianceSummary(
  bookings: { checkIn: Date | string; hotelEyeStatus?: string | null; hotelEyeFiledAt?: Date | string | null }[],
  day: Date = new Date()
) {
  const sameDay = (d: Date | string) => {
    const x = new Date(d)
    return x.getFullYear() === day.getFullYear()
      && x.getMonth() === day.getMonth()
      && x.getDate() === day.getDate()
  }

  const arrivals = bookings.filter((b) => sameDay(b.checkIn))
  const filed = arrivals.filter((b) => getFilingStatus(b, day).state === 'FILED')
  const overdue = arrivals.filter((b) => getFilingStatus(b, day).state === 'OVERDUE')

  return {
    total: arrivals.length,
    filed: filed.length,
    overdue: overdue.length,
    /** True only when every arrival that day is on the portal. */
    clear: arrivals.length > 0 && filed.length === arrivals.length,
  }
}

export const FILING_STATE_META: Record<FilingState, { label: string; className: string }> = {
  FILED:    { label: 'Filed',    className: 'text-green-600 border-green-600/40 bg-green-500/10' },
  QUEUED:   { label: 'Filing',   className: 'text-blue-500 border-blue-500/40 bg-blue-500/10' },
  PENDING:  { label: 'Not filed',className: 'text-muted-foreground border-border bg-muted/40' },
  DUE_SOON: { label: 'Due soon', className: 'text-amber-500 border-amber-500/40 bg-amber-500/10' },
  OVERDUE:  { label: 'Overdue',  className: 'text-rose-500 border-rose-500/40 bg-rose-500/10' },
  FAILED:   { label: 'Failed',   className: 'text-rose-500 border-rose-500/40 bg-rose-500/10' },
}
