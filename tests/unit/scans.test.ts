import {
  isScanKind, hasKind, cnicComplete, passportComplete, anyScan, scansOfKind, SCAN_LABELS,
} from '@/lib/scans'

const cnicFront = { id: '1', kind: 'CNIC_FRONT' }
const cnicBack = { id: '2', kind: 'CNIC_BACK' }
const passport = { id: '3', kind: 'PASSPORT' }
const plainUpload = { id: '4', kind: null }

describe('isScanKind', () => {
  it('accepts the three card types', () => {
    expect(isScanKind('CNIC_FRONT')).toBe(true)
    expect(isScanKind('CNIC_BACK')).toBe(true)
    expect(isScanKind('PASSPORT')).toBe(true)
  })

  /* The upload route stores an unrecognised kind as null rather than failing,
     so an ordinary document upload with no kind is still a valid upload. */
  it('rejects anything else, including a missing value', () => {
    expect(isScanKind(null)).toBe(false)
    expect(isScanKind(undefined)).toBe(false)
    expect(isScanKind('')).toBe(false)
    expect(isScanKind('DRIVING_LICENCE')).toBe(false)
    expect(isScanKind(3)).toBe(false)
  })
})

describe('cnicComplete', () => {
  it('needs both sides — the back carries the address', () => {
    expect(cnicComplete([cnicFront])).toBe(false)
    expect(cnicComplete([cnicBack])).toBe(false)
    expect(cnicComplete([cnicFront, cnicBack])).toBe(true)
  })

  /* The two cards are independent: a foreign guest with a passport on file
     still has no CNIC, and must not be treated as if they had. */
  it('is not satisfied by a passport', () => {
    expect(cnicComplete([passport])).toBe(false)
  })

  it('ignores an ordinary upload with no kind', () => {
    expect(cnicComplete([plainUpload, plainUpload])).toBe(false)
  })
})

describe('passportComplete', () => {
  it('needs the one bio page and nothing else', () => {
    expect(passportComplete([passport])).toBe(true)
  })

  // the other direction of the same independence
  it('is not satisfied by a complete CNIC', () => {
    expect(passportComplete([cnicFront, cnicBack])).toBe(false)
  })
})

describe('hasKind and scansOfKind', () => {
  it('finds a single card among the rest', () => {
    const all = [cnicFront, cnicBack, passport, plainUpload]
    expect(hasKind(all, 'PASSPORT')).toBe(true)
    expect(scansOfKind(all, 'CNIC_BACK')).toEqual([cnicBack])
  })

  it('returns nothing for a card that is not held', () => {
    expect(hasKind([cnicFront], 'PASSPORT')).toBe(false)
    expect(scansOfKind([cnicFront], 'PASSPORT')).toEqual([])
  })
})

describe('anyScan', () => {
  /* The filing checklist asks only whether a card exists. Requiring both cards
     would mark every foreign guest incomplete for a CNIC they cannot have. */
  it('counts one card of any type as evidence on file', () => {
    expect(anyScan([passport])).toBe(true)
    expect(anyScan([cnicFront])).toBe(true)
    expect(anyScan([])).toBe(false)
  })
})

describe('SCAN_LABELS', () => {
  it('names every kind, so a stored scan always renders with a label', () => {
    expect(SCAN_LABELS.CNIC_FRONT).toBe('CNIC front')
    expect(SCAN_LABELS.CNIC_BACK).toBe('CNIC back')
    expect(SCAN_LABELS.PASSPORT).toBe('Passport')
  })
})
