/**
 * The backfill reads a card type out of a filename that a person typed. A wrong
 * guess is worse than none: it would tell the desk a card is on file when it is
 * not, and the guest would never be scanned.
 */

// mirrors kindFromName in scripts/backfill-guest-scans.ts
function kindFromName(name: string): string | null {
  const n = name.toLowerCase()
  if (/passport/.test(n)) return 'PASSPORT'
  if (/(^|[\s_·-])front(\b|[\s_.-])/.test(n)) return 'CNIC_FRONT'
  if (/(^|[\s_·-])back(\b|[\s_.-])/.test(n)) return 'CNIC_BACK'
  return null
}

describe('kindFromName', () => {
  // the two spellings actually present in production
  it('reads the hyphenated names the desk uploaded', () => {
    expect(kindFromName('Muhammad Rehman Liaqat - Front.jpeg')).toBe('CNIC_FRONT')
    expect(kindFromName('Muhammad Rehman Liaqat - Back.jpeg')).toBe('CNIC_BACK')
  })

  it('reads the underscored ones too', () => {
    expect(kindFromName('Muhammad_Umair_Asad_-_Front.jpg')).toBe('CNIC_FRONT')
    expect(kindFromName('Muhammad_Umair_Asad_-_Back.jpg')).toBe('CNIC_BACK')
  })

  it('reads the names the scanner itself generates', () => {
    expect(kindFromName('CNIC front 2026-09-05.jpg')).toBe('CNIC_FRONT')
    expect(kindFromName('CNIC back 2026-09-05.jpg')).toBe('CNIC_BACK')
    expect(kindFromName('Passport 2026-09-05.jpg')).toBe('PASSPORT')
  })

  /* A name with only a person and a date says nothing about which card it is,
     and production has two of exactly that shape. */
  it('leaves an ambiguous name unlabelled rather than guessing', () => {
    expect(kindFromName('Muhammad Rehman Liaqat 27062026.jpeg')).toBeNull()
    expect(kindFromName('Muhammad Umair Asad 2026-06-27.jpeg')).toBeNull()
    expect(kindFromName('scan.jpg')).toBeNull()
  })

  // "Backup" and "Frontier" are not card sides
  it('does not match a word that merely starts with front or back', () => {
    expect(kindFromName('Backup copy.jpeg')).toBeNull()
    expect(kindFromName('Frontier Hotel receipt.pdf')).toBeNull()
  })

  it('prefers passport over a side word, since a passport has no sides', () => {
    expect(kindFromName('Passport - front page.jpg')).toBe('PASSPORT')
  })
})
