/**
 * WhatsApp via click-to-chat links.
 *
 * Deliberately NOT the WhatsApp Business Platform (Cloud API). Registering a
 * number on the Cloud API historically takes it out of the WhatsApp Business
 * app — the number lives in one place or the other. A wa.me link registers
 * nothing: it opens the chat in whichever WhatsApp is already installed, with
 * the text prefilled, and a person presses send. The number keeps working on
 * the phone and on WhatsApp Web exactly as it does now.
 *
 * What that costs: no delivery receipts, no inbound messages, no scheduled or
 * automatic sending. Every message is a person tapping send. See twa/README.md
 * for the Cloud API path if that stops being enough.
 *
 * NEVER put CNIC, passport numbers or scan images in one of these messages.
 * WhatsApp is not a filing channel and the guest's document data has no reason
 * to leave the app.
 */

import { normalizePhone } from './guests'

/** Pakistan. Numbers typed without a country code are assumed to be local. */
const DEFAULT_COUNTRY_CODE = '92'

/**
 * The digits wa.me wants: full international, no '+', no separators.
 *
 * Guests are not all Pakistani — this app records passports and nationality —
 * so a number that already carries a country code is passed through rather
 * than re-prefixed.
 */
export function waNumber(phone?: string | null, countryCode = DEFAULT_COUNTRY_CODE): string | null {
  const raw = (phone || '').trim()
  const digits = raw.replace(/\D/g, '')
  if (!digits) return null

  // A leading + or 00 means the country code is already there.
  if (raw.startsWith('+')) return digits
  if (digits.startsWith('00')) return digits.slice(2)

  const national = normalizePhone(raw)
  if (!national) return null

  // A Pakistani mobile is ten national digits starting 3. Anything else is a
  // landline, a foreign number or a typo — pass it through as typed instead of
  // guessing a country code onto it.
  return national.length === 10 && national.startsWith('3') ? countryCode + national : digits
}

/** null when there is no usable number, so callers can hide the button. */
export function waLink(phone?: string | null, message?: string): string | null {
  const number = waNumber(phone)
  if (!number) return null
  const text = message?.trim()
  return `https://wa.me/${number}${text ? `?text=${encodeURIComponent(text)}` : ''}`
}

type MessageBooking = {
  guestName: string
  checkIn: string | Date
  checkOut: string | Date
  totalAmount: number
  paidAmount?: number | null
  property?: { name?: string | null } | null
}

const day = (d: string | Date) =>
  new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

/** First name only — "Dear Muhammad Asif Khan" reads like a bank letter. */
const firstName = (name: string) => name.trim().split(/\s+/)[0] || name

export function confirmationMessage(b: MessageBooking, currency = 'PKR'): string {
  const where = b.property?.name ? ` at ${b.property.name}` : ''
  return [
    `Assalam-o-Alaikum ${firstName(b.guestName)},`,
    ``,
    `Your booking${where} is confirmed.`,
    `Check-in: ${day(b.checkIn)}`,
    `Check-out: ${day(b.checkOut)}`,
    `Total: ${currency} ${b.totalAmount.toLocaleString()}`,
    ``,
    `Please bring your CNIC or passport for check-in. Let us know your arrival time and we will keep the room ready.`,
  ].join('\n')
}

export function paymentReminderMessage(b: MessageBooking, currency = 'PKR'): string {
  const owed = b.totalAmount - (b.paidAmount ?? 0)
  return [
    `Assalam-o-Alaikum ${firstName(b.guestName)},`,
    ``,
    `A balance of ${currency} ${owed.toLocaleString()} is outstanding on your stay (${day(b.checkIn)} – ${day(b.checkOut)}).`,
    ``,
    `Please let us know if you would like to settle it by cash, transfer or card. Thank you.`,
  ].join('\n')
}
