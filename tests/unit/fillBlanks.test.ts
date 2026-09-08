import { fillBlanks } from '@/lib/guests'

/**
 * A stay teaches its guest profile whatever the profile does not already hold.
 *
 * Getting the direction wrong is the expensive failure: a booking that omits a
 * field would silently erase what an earlier stay recorded, and a scan reading
 * a smudged photograph would overwrite a value the desk had corrected by hand.
 */

const PROFILE = {
  name: 'Hamza Naeem',
  phone: '03071130001',
  email: null,
  cnic: '35202-1234567-1',
  fatherName: null,
  gender: null,
  address: '   ',
  passportNumber: null,
}

describe('fillBlanks', () => {
  it('teaches the profile what the stay knows and it does not', () => {
    expect(fillBlanks(PROFILE, { fatherName: 'Naeem Ahmed', gender: 'Male' }))
      .toEqual({ fatherName: 'Naeem Ahmed', gender: 'Male' })
  })

  /* The profile is the edited copy. A value someone corrected by hand outranks
     whatever a later scan reads off a photograph. */
  it('never overwrites a value the profile already holds', () => {
    expect(fillBlanks(PROFILE, { phone: '03009999999', cnic: '11111-1111111-1' })).toEqual({})
  })

  // a stay that simply omits a field must not be read as "clear it"
  it('ignores blank, null and undefined incoming values', () => {
    expect(fillBlanks(PROFILE, { fatherName: '', gender: null, email: undefined })).toEqual({})
  })

  it('treats whitespace on the profile as missing, and fills it', () => {
    expect(fillBlanks(PROFILE, { address: 'House 4, Model Town' }))
      .toEqual({ address: 'House 4, Model Town' })
  })

  it('does not fill whitespace over a blank: an incoming space teaches nothing', () => {
    expect(fillBlanks(PROFILE, { fatherName: '   ' })).toEqual({})
  })

  it('trims what it does write', () => {
    expect(fillBlanks(PROFILE, { gender: '  Male  ' })).toEqual({ gender: 'Male' })
  })

  it('returns nothing when the stay adds nothing, so no write is issued', () => {
    expect(fillBlanks(PROFILE, {})).toEqual({})
  })

  /* The whole point of the change: a scanned card reaches every field of the
     profile, not just the document number. */
  it('carries a full card across in one pass', () => {
    const empty = {
      phone: null, email: null, cnic: null, fatherName: null, gender: null,
      address: null, province: null, district: null,
      passportNumber: null, nationality: null, passportExpiry: null,
    }
    const scanned = {
      cnic: '35202-1234567-1', fatherName: 'Naeem Ahmed', gender: 'Male',
      address: 'House 4, Model Town', province: 'Punjab', district: 'Lahore',
    }
    expect(fillBlanks(empty, scanned)).toEqual(scanned)
  })
})
