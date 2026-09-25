import { districtToProvince } from '@/lib/pakistan'

describe('districtToProvince', () => {
  it('finds the province the card never prints', () => {
    expect(districtToProvince('Faisalabad')).toBe('Punjab')
    expect(districtToProvince('Peshawar')).toBe('Khyber Pakhtunkhwa')
    expect(districtToProvince('Quetta')).toBe('Balochistan')
    expect(districtToProvince('Hyderabad')).toBe('Sindh')
    expect(districtToProvince('Islamabad')).toBe('Islamabad Capital Territory')
  })

  /* The card's transliteration splits and cases names unpredictably — the same
     district reaches this function as "FAISALABAD", "Faisal Abad" or
     "Faisalabad District" depending on the photo. */
  it('reads one district however the scan spelled it', () => {
    for (const spelling of ['FAISALABAD', 'faisalabad', 'Faisal Abad', 'Faisalabad District', ' Faisalabad ']) {
      expect(districtToProvince(spelling)).toBe('Punjab')
    }
  })

  it('handles the Urdu label surviving the transliteration', () => {
    expect(districtToProvince('Zila Faisalabad')).toBe('Punjab')
    expect(districtToProvince('Distt. Multan')).toBe('Punjab')
  })

  it('separates the two Hyderabads by name only, never by guess', () => {
    // Sindh's Hyderabad is the district; there is no Punjab entry to collide
    expect(districtToProvince('Hyderabad')).toBe('Sindh')
  })

  /* A wrong province filed to a government portal is worse than a blank one a
     person has to fill, so anything unrecognised must come back empty rather
     than land on a best guess. */
  it('returns empty for a district it does not know', () => {
    expect(districtToProvince('Springfield')).toBe('')
    expect(districtToProvince('')).toBe('')
    expect(districtToProvince(null)).toBe('')
    expect(districtToProvince(undefined)).toBe('')
  })

  it('does not match a partial or run-together name', () => {
    expect(districtToProvince('Faisal')).toBe('')
    expect(districtToProvince('LahoreKarachi')).toBe('')
  })
})
