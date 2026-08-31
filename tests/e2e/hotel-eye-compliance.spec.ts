import { test, expect } from '@playwright/test'
import { signIn } from './helpers/session'
import { stubApi, waitForData } from './helpers/api'

/**
 * The filing deadline is the product's whole compliance claim: every guest
 * entered within 24 hours, and any failure surfaced rather than sitting
 * silently in a job table. These specs cover what the desk actually sees.
 */

const HOUR = 60 * 60 * 1000
const ago = (hours: number) => new Date(Date.now() - hours * HOUR).toISOString()

const booking = (
  id: string, guestName: string, checkInHoursAgo: number,
  hotelEyeStatus: string, extra: Record<string, unknown> = {}
) => ({
  id, guestName, guestEmail: '', guestPhone: '',
  checkIn: ago(checkInHoursAgo), checkOut: new Date(Date.now() + HOUR).toISOString(),
  nights: 1, rate: 10000, cleaningFee: 0, platformFee: 0,
  totalAmount: 10000, netAmount: 10000, paidAmount: 10000,
  platform: 'DIRECT', status: 'CONFIRMED', propertyId: 'p1',
  property: { id: 'p1', name: 'Room 1' }, notes: '',
  hotelEyeStatus, miscCharges: 0, ...extra,
})

const BOOKINGS = [
  booking('h1', 'Overdue Guest', 30, 'NOT_ENTERED'),
  booking('h2', 'Due Soon Guest', 20, 'NOT_ENTERED'),
  booking('h3', 'Filed Guest', 5, 'ENTERED', { hotelEyeFiledAt: ago(4) }),
  booking('h4', 'Failed Guest', 3, 'FAILED', { hotelEyeError: 'Portal rejected the CNIC format' }),
]

test.describe('Hotel Eye — filing deadline', () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await signIn(context, baseURL!)
    await stubApi(context, { bookings: BOOKINGS as never })
  })

  /* The card holds two comboboxes — Hotel Eye first, then the booking
     lifecycle status. Taking the last one would assert against the wrong control. */
  const chip = (page: import('@playwright/test').Page, guest: string) =>
    page.locator('.group').filter({ hasText: guest }).first().getByRole('combobox').first()

  test('distinguishes overdue, due-soon, filed and failed', async ({ page }) => {
    await page.goto('/dashboard/bookings')
    await waitForData(page, 'Overdue Guest')

    // 30h since check-in and still unfiled — past the 24h window
    await expect(chip(page, 'Overdue Guest')).toContainText('Overdue')
    // 20h in, 4h of the window left
    await expect(chip(page, 'Due Soon Guest')).toContainText('Due in')
    await expect(chip(page, 'Filed Guest')).toContainText('Filed')
    // a failure must not read as merely "not filed yet"
    await expect(chip(page, 'Failed Guest')).toContainText('Failed')
  })

  test('a late filing still reads as filed, not overdue', async ({ context, page }) => {
    await context.unroute('**/api/**')
    await stubApi(context, {
      // checked in 40h ago but entered on the portal — the record stands
      bookings: [booking('late', 'Late But Filed', 40, 'ENTERED', { hotelEyeFiledAt: ago(2) })] as never,
    })

    await page.goto('/dashboard/bookings')
    await waitForData(page, 'Late But Filed')

    const c = chip(page, 'Late But Filed')
    await expect(c).toContainText('Filed')
    await expect(c).not.toContainText('Overdue')
  })

  test('surfaces the failure reason rather than burying it in the job table', async ({ page }) => {
    await page.goto('/dashboard/bookings')
    await waitForData(page, 'Failed Guest')

    await expect(chip(page, 'Failed Guest'))
      .toHaveAttribute('title', /Portal rejected the CNIC format/)
  })

  test('shows the day compliance banner and filters from it', async ({ page }) => {
    await page.goto('/dashboard/bookings')
    await waitForData(page, 'Overdue Guest')

    const banner = page.getByRole('button', { name: /Hotel Eye today/i })
    await expect(banner).toBeVisible()
    await expect(banner).toContainText('overdue past 24h')

    await banner.click()
    // clicking through narrows the list to the exposure
    await expect(page.getByRole('combobox').filter({ hasText: /Overdue/ }).first()).toBeVisible()
  })
})
