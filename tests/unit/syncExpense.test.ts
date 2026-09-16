import { expenseDateFields, hisaabMarker, pktDayWindow, syncExpenseSchema } from '@/lib/syncExpense'

const valid = {
  txId: 'tx_1',
  day: '2026-09-15',
  amount: 6000,
  description: 'Geyser repair',
  category: 'REPAIRS',
}

describe('syncExpenseSchema', () => {
  it('accepts a well-formed expense', () => {
    expect(syncExpenseSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects a category this app does not have', () => {
    expect(syncExpenseSchema.safeParse({ ...valid, category: 'Repairs' }).success).toBe(false)
  })

  it('rejects zero, negative and missing amounts', () => {
    expect(syncExpenseSchema.safeParse({ ...valid, amount: 0 }).success).toBe(false)
    expect(syncExpenseSchema.safeParse({ ...valid, amount: -5 }).success).toBe(false)
    expect(syncExpenseSchema.safeParse({ ...valid, amount: undefined }).success).toBe(false)
  })

  it('rejects a day that rolls over', () => {
    expect(syncExpenseSchema.safeParse({ ...valid, day: '2026-02-31' }).success).toBe(false)
    expect(syncExpenseSchema.safeParse({ ...valid, day: '15-09-2026' }).success).toBe(false)
  })
})

describe('expenseDateFields', () => {
  it('stores UTC midnight with month and year from that day, like the form does', () => {
    const f = expenseDateFields('2026-01-01')
    expect(f.date.toISOString()).toBe('2026-01-01T00:00:00.000Z')
    expect(f.month).toBe(1)
    expect(f.year).toBe(2026)
  })
})

describe('pktDayWindow', () => {
  const w = pktDayWindow('2026-09-15')

  it('runs from PKT midnight to the next PKT midnight', () => {
    expect(w.gte.toISOString()).toBe('2026-09-14T19:00:00.000Z')
    expect(w.lt.toISOString()).toBe('2026-09-15T19:00:00.000Z')
  })

  /* A form-entered expense for the same day must fall inside, or the duplicate
     check would miss it and the money would be booked twice. */
  it('contains what the form stores for that day', () => {
    const stored = expenseDateFields('2026-09-15').date
    expect(stored >= w.gte && stored < w.lt).toBe(true)
  })

  it('excludes the neighbouring days', () => {
    expect(expenseDateFields('2026-09-14').date < w.gte).toBe(true)
    expect(expenseDateFields('2026-09-16').date >= w.lt).toBe(true)
  })
})

describe('hisaabMarker', () => {
  /* notes matching uses `contains`, so one entry's marker must not be a
     substring that another entry's id could complete. cuids are fixed-length,
     but assert the shape the routes depend on. */
  it('prefixes the Hisaab entry id', () => {
    expect(hisaabMarker('ckabc123')).toBe('hisaab:ckabc123')
  })
})
