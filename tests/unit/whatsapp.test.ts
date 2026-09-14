import { waNumber, waLink, paymentReminderMessage } from '@/lib/whatsapp'

describe('waNumber', () => {
  it('adds the Pakistan country code to a local mobile', () => {
    expect(waNumber('0307 113 0001')).toBe('923071130001')
    expect(waNumber('03071130001')).toBe('923071130001')
  })

  it('leaves a number that already carries a country code alone', () => {
    expect(waNumber('+92 307 1130001')).toBe('923071130001')
    expect(waNumber('0092 307 1130001')).toBe('923071130001')
    expect(waNumber('923071130001')).toBe('923071130001')
  })

  it('does not prefix 92 onto a foreign number', () => {
    expect(waNumber('+44 7700 900123')).toBe('447700900123')
    expect(waNumber('+1 928 555 0100')).toBe('19285550100')
  })

  it('returns null when there is nothing to dial', () => {
    expect(waNumber('')).toBeNull()
    expect(waNumber(null)).toBeNull()
    expect(waNumber('n/a')).toBeNull()
  })
})

describe('waLink', () => {
  it('encodes the message', () => {
    expect(waLink('03071130001', 'Salam Ali')).toBe('https://wa.me/923071130001?text=Salam%20Ali')
  })

  it('is null without a number, so the button can hide', () => {
    expect(waLink(null, 'hi')).toBeNull()
  })
})

describe('paymentReminderMessage', () => {
  it('states the balance, not the total', () => {
    const msg = paymentReminderMessage({
      guestName: 'Ali Raza Khan',
      checkIn: '2026-09-01',
      checkOut: '2026-09-04',
      totalAmount: 30000,
      paidAmount: 10000,
    })
    expect(msg).toContain('PKR 20,000')
    expect(msg).toContain('Ali,')
    expect(msg).not.toContain('30,000')
  })
})
