import {
  formatCurrency, formatDate, calculateNights, getOccupancyRate,
  getPlatformColor, getStatusColor, slugify, generatePagination,
} from '@/lib/utils'

describe('formatCurrency', () => {
  it('formats USD correctly', () => {
    expect(formatCurrency(1500)).toBe('$1,500')
    expect(formatCurrency(0)).toBe('$0')
    expect(formatCurrency(99.99)).toBe('$99.99')
  })

  it('handles negative values', () => {
    expect(formatCurrency(-250)).toBe('-$250')
  })
})

describe('formatDate', () => {
  it('formats date correctly', () => {
    const date = new Date('2025-01-15')
    expect(formatDate(date)).toBe('Jan 15, 2025')
  })

  it('accepts string dates', () => {
    expect(formatDate('2025-06-01')).toBe('Jun 01, 2025')
  })
})

describe('calculateNights', () => {
  it('calculates nights correctly', () => {
    expect(calculateNights('2025-01-01', '2025-01-05')).toBe(4)
    expect(calculateNights('2025-01-15', '2025-01-16')).toBe(1)
  })

  it('returns 0 for same-day', () => {
    expect(calculateNights('2025-01-01', '2025-01-01')).toBe(0)
  })
})

describe('getOccupancyRate', () => {
  it('calculates occupancy correctly', () => {
    expect(getOccupancyRate(15, 30)).toBe(50)
    expect(getOccupancyRate(30, 30)).toBe(100)
    expect(getOccupancyRate(0, 30)).toBe(0)
  })

  it('returns 0 when total is 0', () => {
    expect(getOccupancyRate(10, 0)).toBe(0)
  })
})

describe('getPlatformColor', () => {
  it('returns correct colors', () => {
    expect(getPlatformColor('AIRBNB')).toContain('rose')
    expect(getPlatformColor('DIRECT')).toContain('blue')
    expect(getPlatformColor('UNKNOWN')).toContain('gray')
  })
})

describe('getStatusColor', () => {
  it('returns correct colors', () => {
    expect(getStatusColor('CONFIRMED')).toContain('green')
    expect(getStatusColor('CANCELLED')).toContain('red')
    expect(getStatusColor('PENDING')).toContain('yellow')
    expect(getStatusColor('UNKNOWN')).toContain('gray')
  })
})

describe('slugify', () => {
  it('creates valid slugs', () => {
    expect(slugify('Room 1 Deluxe')).toBe('room-1-deluxe')
    expect(slugify('  Hello World  ')).toBe('hello-world')
    expect(slugify('Café & Bar')).toBe('caf-bar')
  })
})

describe('generatePagination', () => {
  it('returns all pages for small totals', () => {
    const pages = generatePagination(1, 5)
    expect(pages).toEqual([1, 2, 3, 4, 5])
  })

  it('includes ellipsis for large totals', () => {
    const pages = generatePagination(5, 20)
    expect(pages).toContain('...')
  })

  it('handles first page', () => {
    const pages = generatePagination(1, 20)
    expect(pages[0]).toBe(1)
  })

  it('handles last page', () => {
    const pages = generatePagination(20, 20)
    expect(pages[pages.length - 1]).toBe(20)
  })
})
