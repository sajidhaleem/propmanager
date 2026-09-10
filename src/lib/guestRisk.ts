import { z } from 'zod'

/**
 * Do-not-book records.
 *
 * A guesthouse has to be able to say "not this one again" — after a guest
 * leaves without paying, damages a room, or is abusive to staff. This is that
 * record. What it deliberately is *not* is as important as what it is, so the
 * boundaries are written down here rather than left to whoever edits the UI
 * next.
 *
 * ── Internal to this property ────────────────────────────────────────────────
 * Nothing here is shared, exported, published or synced anywhere. A flag is a
 * private note about a commercial decision this business is entitled to make
 * about its own rooms. The moment the same words are handed to another
 * property, a platform, or a group chat, they stop being a private note and
 * become a statement about a named person published to third parties — which
 * is a different thing entirely, and one this app should not help with. There
 * is deliberately no export, no share, and no cross-property feed. If that is
 * ever wanted, it needs a lawyer, not a pull request.
 *
 * ── A warning, never an automatic refusal ────────────────────────────────────
 * A flag warns the desk and asks for a deliberate decision. It does not block
 * the booking. Two reasons: an automatic bar is exactly the shape a
 * discrimination complaint needs, and a desk that cannot override will simply
 * type the name slightly differently — which destroys the record the flag
 * existed to keep.
 *
 * ── Never part of a Hotel Eye filing ─────────────────────────────────────────
 * The statutory filing is a record of who stayed. An opinion about them has no
 * business travelling with it, and nothing in this module is ever read by the
 * filing code.
 *
 * ── Conduct, not characteristics ─────────────────────────────────────────────
 * Reasons are a fixed list of things a person *did*. There is no free-text-only
 * path, because free text is where "difficult family" and worse get written.
 * Anything typed here can be read back later by the guest, by a platform, or in
 * a dispute — the UI says so at the point of typing.
 *
 * ── Not permanent ───────────────────────────────────────────────────────────
 * Every flag carries a review date. An unreviewed flag is shown as stale rather
 * than quietly enforced for ever, so a bad night in 2024 is not still costing
 * someone a room in 2030.
 */

export const GUEST_RISK_LEVELS = [
  {
    key: 'CAUTION',
    label: 'Caution',
    desk: 'Take the booking, but tell a manager.',
  },
  {
    key: 'DO_NOT_BOOK',
    label: 'Do not book',
    desk: 'Decline unless a manager approves it.',
  },
] as const

export type GuestRiskLevel = (typeof GUEST_RISK_LEVELS)[number]['key']

/**
 * What the guest did. Fixed list on purpose — see the header.
 *
 * Each one is an act, observable and arguable. None of them is a description of
 * a person: no nationality, sect, ethnicity, marital status, gender, age or
 * appearance appears here, and none should ever be added.
 */
export const GUEST_RISK_REASONS = [
  { key: 'UNPAID',        label: 'Left without settling the bill' },
  { key: 'DAMAGE',        label: 'Damaged the room or its contents' },
  { key: 'HOUSE_RULES',   label: 'Broke house rules after being asked to stop' },
  { key: 'CONDUCT',       label: 'Abusive or threatening to staff or guests' },
  { key: 'FALSE_ID',      label: 'Refused ID, or gave identity details that did not check out' },
  { key: 'NO_SHOW',       label: 'Repeated no-shows on held rooms' },
  { key: 'OTHER',         label: 'Other — describe it in the note' },
] as const

export type GuestRiskReason = (typeof GUEST_RISK_REASONS)[number]['key']

/** A flag set today comes up for review in a year unless someone says sooner. */
export const DEFAULT_REVIEW_MONTHS = 12

export const guestRiskSchema = z.object({
  riskLevel: z.enum(['CAUTION', 'DO_NOT_BOOK']).nullable(),
  riskReason: z.enum(['UNPAID', 'DAMAGE', 'HOUSE_RULES', 'CONDUCT', 'FALSE_ID', 'NO_SHOW', 'OTHER']).nullish(),
  /* Short by design. A paragraph invites the kind of detail that reads badly
     when the guest asks what you hold about them — and they may. */
  riskNote: z.string().max(280, 'Keep the note under 280 characters').nullish(),
  riskReviewAt: z.string().nullish(),
})
  /* OTHER says nothing on its own, and a flag nobody can justify later is worse
     than no flag: it cannot be explained to the guest, to a platform, or to the
     manager who has to decide whether to override it. */
  .refine(
    (v) => v.riskLevel === null || v.riskReason !== 'OTHER' || !!v.riskNote?.trim(),
    { message: 'Describe what happened when the reason is Other', path: ['riskNote'] },
  )
  .refine(
    (v) => v.riskLevel === null || !!v.riskReason,
    { message: 'Pick what happened', path: ['riskReason'] },
  )

export type GuestRiskInput = z.infer<typeof guestRiskSchema>

export interface GuestRiskFields {
  riskLevel?: string | null
  riskReason?: string | null
  riskNote?: string | null
  riskSetBy?: string | null
  riskSetAt?: string | Date | null
  riskReviewAt?: string | Date | null
}

export interface GuestRiskStatus {
  level: GuestRiskLevel
  label: string
  /** One line for the desk: what to actually do. */
  desk: string
  reason: string
  note?: string | null
  setBy?: string | null
  setAt?: Date | null
  reviewAt?: Date | null
  /** Past its review date: still shown, but as a decision nobody has renewed. */
  stale: boolean
}

/**
 * The flag on a guest, or null when there is none.
 *
 * Returns null for an unrecognised level rather than guessing, so a value that
 * predates a change to the vocabulary fails quiet instead of warning the desk
 * about something nobody can explain.
 */
export function guestRiskStatus(
  guest: GuestRiskFields | null | undefined,
  now: Date = new Date(),
): GuestRiskStatus | null {
  const level = GUEST_RISK_LEVELS.find((l) => l.key === guest?.riskLevel)
  if (!guest || !level) return null

  const reviewAt = guest.riskReviewAt ? new Date(guest.riskReviewAt) : null
  const reason = GUEST_RISK_REASONS.find((r) => r.key === guest.riskReason)

  return {
    level: level.key,
    label: level.label,
    desk: level.desk,
    reason: reason?.label ?? 'Reason not recorded',
    note: guest.riskNote,
    setBy: guest.riskSetBy,
    setAt: guest.riskSetAt ? new Date(guest.riskSetAt) : null,
    reviewAt,
    stale: !!reviewAt && reviewAt.getTime() <= now.getTime(),
  }
}

/** The default review date offered when a flag is set. */
export function defaultReviewDate(from: Date = new Date()): Date {
  const d = new Date(from)
  d.setMonth(d.getMonth() + DEFAULT_REVIEW_MONTHS)
  return d
}
