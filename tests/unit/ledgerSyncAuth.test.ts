import { ledgerSecretValid } from '@/lib/ledgerSyncAuth'

describe('ledgerSecretValid', () => {
  const original = { read: process.env.LEDGER_SYNC_SECRET, write: process.env.LEDGER_WRITE_SECRET }

  afterEach(() => {
    for (const [name, value] of [['LEDGER_SYNC_SECRET', original.read], ['LEDGER_WRITE_SECRET', original.write]] as const) {
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
  })

  beforeEach(() => {
    process.env.LEDGER_SYNC_SECRET = 'read-key-0123456789'
    process.env.LEDGER_WRITE_SECRET = 'write-key-0123456789'
  })

  it('accepts each secret for its own endpoint', () => {
    expect(ledgerSecretValid('read-key-0123456789', 'LEDGER_SYNC_SECRET')).toBe(true)
    expect(ledgerSecretValid('write-key-0123456789', 'LEDGER_WRITE_SECRET')).toBe(true)
  })

  /* The reason there are two: a leaked read key must not be able to write. */
  it('rejects the read secret on a write endpoint', () => {
    expect(ledgerSecretValid('read-key-0123456789', 'LEDGER_WRITE_SECRET')).toBe(false)
  })

  it('rejects wrong, partial and missing secrets', () => {
    expect(ledgerSecretValid('write-key-012345678X', 'LEDGER_WRITE_SECRET')).toBe(false)
    expect(ledgerSecretValid('write-key', 'LEDGER_WRITE_SECRET')).toBe(false)
    expect(ledgerSecretValid(null, 'LEDGER_WRITE_SECRET')).toBe(false)
    expect(ledgerSecretValid('', 'LEDGER_WRITE_SECRET')).toBe(false)
  })

  it('fails closed when the secret is unset or too short', () => {
    delete process.env.LEDGER_WRITE_SECRET
    expect(ledgerSecretValid('', 'LEDGER_WRITE_SECRET')).toBe(false)
    process.env.LEDGER_WRITE_SECRET = 'short'
    expect(ledgerSecretValid('short', 'LEDGER_WRITE_SECRET')).toBe(false)
  })
})
