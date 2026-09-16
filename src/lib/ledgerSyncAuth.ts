import { timingSafeEqual } from 'node:crypto'

/**
 * Shared-secret check for the endpoints Hisaab calls server-to-server.
 *
 * Two secrets, not one. LEDGER_SYNC_SECRET lets Hisaab read the ledger;
 * LEDGER_WRITE_SECRET lets it enter expenses. A leaked read key must never be
 * enough to change the books, so each endpoint accepts only its own.
 *
 * Fails CLOSED: an unset or short secret rejects everything, so a deploy that
 * forgets the variable turns the feature off rather than open.
 */
export type LedgerSecret = 'LEDGER_SYNC_SECRET' | 'LEDGER_WRITE_SECRET'

export function ledgerSecretValid(given: string | null | undefined, name: LedgerSecret): boolean {
  const expected = process.env[name]
  if (!expected || expected.length < 16) return false

  const a = Buffer.from(given || '', 'utf8')
  const b = Buffer.from(expected, 'utf8')
  // timingSafeEqual throws on a length mismatch; lengths are not secret.
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
