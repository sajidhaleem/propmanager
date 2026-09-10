import {
  guestRiskStatus, guestRiskSchema, defaultReviewDate,
  GUEST_RISK_REASONS, DEFAULT_REVIEW_MONTHS,
} from '@/lib/guestRisk'

const NOW = new Date('2026-09-11T12:00:00.000Z')

describe('guestRiskStatus', () => {
  it('returns nothing for a guest with no flag — the normal case', () => {
    expect(guestRiskStatus(null)).toBeNull()
    expect(guestRiskStatus({})).toBeNull()
    expect(guestRiskStatus({ riskLevel: null })).toBeNull()
  })

  it('reads a flag back as the desk instruction, not the raw code', () => {
    const s = guestRiskStatus({
      riskLevel: 'DO_NOT_BOOK', riskReason: 'UNPAID', riskNote: 'Left Rs 12,000 unpaid',
      riskSetBy: 'Sajid', riskSetAt: '2026-03-14T00:00:00.000Z',
      riskReviewAt: '2027-03-14T00:00:00.000Z',
    }, NOW)

    expect(s).toMatchObject({
      level: 'DO_NOT_BOOK',
      label: 'Do not book',
      reason: 'Left without settling the bill',
      setBy: 'Sajid',
      stale: false,
    })
    expect(s!.desk).toMatch(/manager/i)
  })

  /* A flag nobody has renewed is still shown — quietly dropping it would hide a
     real decision — but it is marked, so a stale one is not enforced for ever
     by inertia. */
  it('marks a flag past its review date as stale without hiding it', () => {
    const s = guestRiskStatus({
      riskLevel: 'CAUTION', riskReason: 'DAMAGE', riskReviewAt: '2026-01-01T00:00:00.000Z',
    }, NOW)
    expect(s!.stale).toBe(true)
    expect(s!.level).toBe('CAUTION')
  })

  /* Fails quiet rather than warning the desk about something nobody can
     explain — the value could predate a change to the vocabulary. */
  it('ignores a level it does not recognise', () => {
    expect(guestRiskStatus({ riskLevel: 'BANNED_FOREVER', riskReason: 'UNPAID' }, NOW)).toBeNull()
  })

  it('says so plainly when the reason was never recorded', () => {
    const s = guestRiskStatus({ riskLevel: 'CAUTION' }, NOW)
    expect(s!.reason).toBe('Reason not recorded')
  })
})

describe('guestRiskSchema', () => {
  const valid = { riskLevel: 'DO_NOT_BOOK', riskReason: 'UNPAID', riskNote: 'Room 3, 14 March' }

  it('accepts a flag with a reason', () => {
    expect(guestRiskSchema.safeParse(valid).success).toBe(true)
  })

  it('accepts a null level, which is how a flag is lifted', () => {
    expect(guestRiskSchema.safeParse({ riskLevel: null }).success).toBe(true)
  })

  it('will not take a flag with no reason at all', () => {
    const r = guestRiskSchema.safeParse({ riskLevel: 'CAUTION' })
    expect(r.success).toBe(false)
  })

  /* "Other" with no note is a flag nobody can justify later — not to the guest,
     not to a platform, and not to the manager deciding whether to override it. */
  it('will not take Other without a note', () => {
    expect(guestRiskSchema.safeParse({ riskLevel: 'CAUTION', riskReason: 'OTHER' }).success).toBe(false)
    expect(guestRiskSchema.safeParse({ riskLevel: 'CAUTION', riskReason: 'OTHER', riskNote: '   ' }).success).toBe(false)
    expect(guestRiskSchema.safeParse({ riskLevel: 'CAUTION', riskReason: 'OTHER', riskNote: 'Kept setting off the fire alarm' }).success).toBe(true)
  })

  it('keeps the note short', () => {
    expect(guestRiskSchema.safeParse({ ...valid, riskNote: 'x'.repeat(281) }).success).toBe(false)
  })
})

describe('the reason vocabulary', () => {
  /* The one rule that matters most, and the one most likely to be eroded by a
     well-meaning edit: every reason describes an act, never a person. */
  it('offers only things a guest did, never what a guest is', () => {
    // whole words: "Damaged" contains "age", and that is not what this is about
    const forbidden = new RegExp(
      String.raw`\b(religio\w*|sect|caste|ethnic\w*|national\w*|race|colou?rs?|` +
      String.raw`marital|married|couples?|gender|female|male|aged?|appearance|foreign\w*)\b`,
      'i',
    )
    for (const r of GUEST_RISK_REASONS) {
      expect(r.label).not.toMatch(forbidden)
      expect(r.key).not.toMatch(forbidden)
    }
  })
})

describe('defaultReviewDate', () => {
  it('lands a year out, so no flag is set to last for ever by default', () => {
    const d = defaultReviewDate(new Date('2026-09-11T00:00:00.000Z'))
    expect(d.getFullYear()).toBe(2027)
    expect(DEFAULT_REVIEW_MONTHS).toBe(12)
  })
})
