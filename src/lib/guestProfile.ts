/**
 * The numbers behind the guest profile board.
 *
 * Kept out of the page so each one can be checked on its own: several are the
 * difference between "this guest can be filed" and a desk finding out at the
 * portal that the father's name was never recorded.
 */
import { getFilingStatus, type FilingState } from '@/lib/hotelEye'
import type { Guest } from '@/lib/guests'

export interface Stay {
  id: string
  checkIn: string | Date
  checkOut: string | Date
  nights?: number
  totalAmount?: number
  status?: string | null
  hotelEyeStatus?: string | null
  hotelEyeFiledAt?: string | Date | null
  property?: { name?: string | null } | null
}

const has = (v?: string | null) => !!(v && String(v).trim())

/* ── What a Hotel Eye filing needs ───────────────────────────────────────────
   Eight things, because eight is what the portal form asks for. Anything
   missing here is a filing that will bounce, so the board says which one
   rather than reporting a single percentage nobody can act on. */
export interface ChecklistItem {
  key: string
  label: string
  hint: string
  done: boolean
}

export function filingChecklist(guest: Partial<Guest>, cardOnFile: boolean): ChecklistItem[] {
  return [
    { key: 'name',     label: 'Full name',        hint: 'As printed on the card',        done: has(guest.name) },
    { key: 'document', label: 'CNIC or passport', hint: 'One document number is enough', done: has(guest.cnic) || has(guest.passportNumber) },
    { key: 'father',   label: "Father's name",    hint: 'Required for Pakistani guests', done: has(guest.fatherName) },
    { key: 'gender',   label: 'Gender',           hint: 'Portal will not accept blank',  done: has(guest.gender) },
    { key: 'address',  label: 'Home address',     hint: 'Permanent address',             done: has(guest.address) },
    { key: 'region',   label: 'Province & district', hint: 'Both are separate fields',   done: has(guest.province) && has(guest.district) },
    { key: 'phone',    label: 'Phone number',     hint: 'Contact for the register',      done: has(guest.phone) },
    { key: 'card',     label: 'Card image',       hint: 'The evidence behind a filing',  done: cardOnFile },
  ]
}

/** How much of the identity is on file, split the way the desk collects it. */
export function completeness(guest: Partial<Guest>, cardOnFile: boolean) {
  const pct = (flags: boolean[]) =>
    flags.length === 0 ? 0 : Math.round((flags.filter(Boolean).length / flags.length) * 100)

  const identity = pct([has(guest.name), has(guest.cnic) || has(guest.passportNumber), has(guest.fatherName), has(guest.gender), cardOnFile])
  const contact  = pct([has(guest.phone), has(guest.email), has(guest.address)])
  const travel   = pct([has(guest.passportNumber), has(guest.nationality), has(guest.passportExpiry)])

  const items = filingChecklist(guest, cardOnFile)
  return {
    identity,
    contact,
    travel,
    /* Overall is the filing checklist, not the average of the three bars: a
       guest can be 100% on travel fields and still be unfilable. */
    overall: pct(items.map(i => i.done)),
    done: items.filter(i => i.done).length,
    total: items.length,
  }
}

/** Nights per calendar month, oldest first — the profile's bar chart. */
export function nightsByMonth(stays: Stay[], months = 7, now: Date = new Date()) {
  const buckets = Array.from({ length: months }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1)
    return { key: `${d.getFullYear()}-${d.getMonth()}`, date: d, nights: 0 }
  })
  const index = new Map(buckets.map((b, i) => [b.key, i]))

  for (const s of stays) {
    const d = new Date(s.checkIn)
    const i = index.get(`${d.getFullYear()}-${d.getMonth()}`)
    if (i === undefined) continue
    buckets[i].nights += s.nights ?? 1
  }
  return buckets
}

/**
 * The filing record across every stay, as shares of 100.
 *
 * Overdue is pulled out of "not filed" deliberately — they are the same column
 * in the database and completely different situations in law.
 */
export function filingMix(stays: Stay[], now: Date = new Date()) {
  const counts: Record<'filed' | 'filing' | 'unfiled' | 'overdue', number> = {
    filed: 0, filing: 0, unfiled: 0, overdue: 0,
  }
  const bucketOf = (state: FilingState) =>
    state === 'FILED' ? 'filed'
      : state === 'QUEUED' ? 'filing'
        : state === 'OVERDUE' || state === 'FAILED' ? 'overdue'
          : 'unfiled'

  for (const s of stays) counts[bucketOf(getFilingStatus(s, now).state)]++

  const total = stays.length
  const share = (n: number) => (total === 0 ? 0 : Math.round((n / total) * 100))
  return {
    counts,
    total,
    filed: share(counts.filed),
    filing: share(counts.filing),
    unfiled: share(counts.unfiled),
    overdue: share(counts.overdue),
  }
}

/**
 * The stay whose 24-hour clock the desk should be watching: the most recent
 * arrival that is not on the portal. Returns null when nothing is outstanding,
 * which is the state the board should be in most of the time.
 */
export function openFiling(stays: Stay[], now: Date = new Date()) {
  const open = stays
    .filter(s => getFilingStatus(s, now).state !== 'FILED')
    .sort((a, b) => new Date(b.checkIn).getTime() - new Date(a.checkIn).getTime())
  if (open.length === 0) return null
  const stay = open[0]
  return { stay, status: getFilingStatus(stay, now) }
}

export function totalNights(stays: Stay[]): number {
  return stays.reduce((sum, s) => sum + (s.nights ?? 1), 0)
}
