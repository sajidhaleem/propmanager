import { loginSchema, bookingSchema, expenseSchema, payoutSchema, propertySchema } from '@/lib/validations'

describe('loginSchema', () => {
  it('validates correct credentials', () => {
    const result = loginSchema.safeParse({ email: 'test@example.com', password: 'password123' })
    expect(result.success).toBe(true)
  })

  it('rejects invalid email', () => {
    const result = loginSchema.safeParse({ email: 'not-an-email', password: 'password123' })
    expect(result.success).toBe(false)
  })

  it('rejects short password', () => {
    const result = loginSchema.safeParse({ email: 'test@example.com', password: '12345' })
    expect(result.success).toBe(false)
  })
})

describe('bookingSchema', () => {
  const validBooking = {
    guestName: 'John Doe',
    checkIn: '2025-01-01',
    checkOut: '2025-01-05',
    rate: 75,
    cleaningFee: 15,
    platformFee: 5,
    platform: 'AIRBNB',
    status: 'CONFIRMED',
    propertyId: 'test-property-id',
  }

  it('validates correct booking', () => {
    const result = bookingSchema.safeParse(validBooking)
    expect(result.success).toBe(true)
  })

  it('rejects missing guest name', () => {
    const result = bookingSchema.safeParse({ ...validBooking, guestName: '' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid platform', () => {
    const result = bookingSchema.safeParse({ ...validBooking, platform: 'INVALID' })
    expect(result.success).toBe(false)
  })

  it('rejects negative rate', () => {
    const result = bookingSchema.safeParse({ ...validBooking, rate: -10 })
    expect(result.success).toBe(false)
  })
})

describe('expenseSchema', () => {
  const validExpense = {
    date: '2025-01-15',
    category: 'CLEANING',
    description: 'Deep cleaning service',
    amount: 150,
    vendor: 'CleanPro',
  }

  it('validates correct expense', () => {
    const result = expenseSchema.safeParse(validExpense)
    expect(result.success).toBe(true)
  })

  it('rejects invalid category', () => {
    const result = expenseSchema.safeParse({ ...validExpense, category: 'INVALID_CAT' })
    expect(result.success).toBe(false)
  })

  it('rejects negative amount', () => {
    const result = expenseSchema.safeParse({ ...validExpense, amount: -50 })
    expect(result.success).toBe(false)
  })
})

describe('payoutSchema', () => {
  const validPayout = {
    recipientName: 'Shahid Ahmed',
    amount: 800,
    date: '2025-01-30',
    type: 'SALARY',
    status: 'PENDING',
  }

  it('validates correct payout', () => {
    const result = payoutSchema.safeParse(validPayout)
    expect(result.success).toBe(true)
  })

  it('rejects short recipient name', () => {
    const result = payoutSchema.safeParse({ ...validPayout, recipientName: 'A' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid type', () => {
    const result = payoutSchema.safeParse({ ...validPayout, type: 'GIFT' })
    expect(result.success).toBe(false)
  })
})

describe('propertySchema', () => {
  const validProperty = {
    name: 'Room 1 Deluxe',
    type: 'room',
    capacity: 2,
    baseRate: 75,
    status: 'ACTIVE',
    amenities: ['WiFi', 'AC'],
  }

  it('validates correct property', () => {
    const result = propertySchema.safeParse(validProperty)
    expect(result.success).toBe(true)
  })

  it('rejects empty name', () => {
    const result = propertySchema.safeParse({ ...validProperty, name: '' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid status', () => {
    const result = propertySchema.safeParse({ ...validProperty, status: 'BROKEN' })
    expect(result.success).toBe(false)
  })
})
