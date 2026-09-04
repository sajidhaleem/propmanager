import { hotelEyeSecretValid } from '@/lib/hotelEyeAuth'

describe('hotelEyeSecretValid', () => {
  const original = process.env.HOTEL_EYE_SECRET

  afterEach(() => {
    if (original === undefined) delete process.env.HOTEL_EYE_SECRET
    else process.env.HOTEL_EYE_SECRET = original
  })

  describe('with the secret configured', () => {
    beforeEach(() => { process.env.HOTEL_EYE_SECRET = 'correct-horse-battery-staple' })

    it('accepts the matching secret', () => {
      expect(hotelEyeSecretValid('correct-horse-battery-staple')).toBe(true)
    })

    it('rejects a wrong secret of the same length', () => {
      expect(hotelEyeSecretValid('correct-horse-battery-stapLE')).toBe(false)
    })

    it('rejects a prefix of the real secret', () => {
      expect(hotelEyeSecretValid('correct-horse')).toBe(false)
    })

    it('rejects a missing header', () => {
      expect(hotelEyeSecretValid(null)).toBe(false)
      expect(hotelEyeSecretValid(undefined)).toBe(false)
      expect(hotelEyeSecretValid('')).toBe(false)
    })
  })

  /* Fail-closed is the whole point: an unconfigured deploy must not turn the
     worker endpoints into open ones. An empty header is the case that would
     otherwise slip through a naive equality check. */
  describe('with the secret unset', () => {
    it('rejects everything, including an empty token', () => {
      delete process.env.HOTEL_EYE_SECRET
      expect(hotelEyeSecretValid('')).toBe(false)
      expect(hotelEyeSecretValid(null)).toBe(false)
      expect(hotelEyeSecretValid('anything')).toBe(false)
    })

    it('rejects when the secret is set to an empty string', () => {
      process.env.HOTEL_EYE_SECRET = ''
      expect(hotelEyeSecretValid('')).toBe(false)
    })
  })
})
