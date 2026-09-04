import { test, expect } from '@playwright/test'
import { signIn } from './helpers/session'
import { stubApi, waitForData } from './helpers/api'

/**
 * Payment status is derived from totalAmount vs paidAmount rather than stored,
 * so the badge and the server-side filter have to agree. The fixtures cover one
 * booking in each state.
 */
/* The whole booking card, not the inner text block — the payment badge sits in
   a sibling of the guest-name column, so a narrower locator misses it. */
const row = (page: import('@playwright/test').Page, guest: string) =>
  page.locator('.group').filter({ hasText: guest }).first()

test.describe('Bookings — payment status', () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await signIn(context, baseURL!)
    await stubApi(context)
  })

  test('badges each booking by what is actually paid', async ({ page }) => {
    await page.goto('/dashboard/bookings?view=all')
    await waitForData(page, 'Fully Paid Guest')

    /* Exact text: the card also carries a Hotel Eye control reading
       "HE: Pending", so a substring match would not tell the two apart. */
    await expect(row(page, 'Fully Paid Guest').getByText('Paid', { exact: true })).toBeVisible()
    await expect(row(page, 'Half Paid Guest').getByText('Partially Paid', { exact: true })).toBeVisible()
    await expect(row(page, 'Unpaid Guest').getByText('Pending', { exact: true })).toBeVisible()
  })

  test('filter narrows the list server-side', async ({ page }) => {
    await page.goto('/dashboard/bookings?view=all')
    await waitForData(page, 'Fully Paid Guest')

    await page.getByRole('combobox').filter({ hasText: /All Payments/ }).first().click()
    await page.getByRole('option', { name: 'Partially Paid', exact: true }).click()

    await expect(page.getByText('Half Paid Guest')).toBeVisible()
    await expect(page.getByText('Unpaid Guest')).toHaveCount(0)
    await expect(page.getByText('Fully Paid Guest')).toHaveCount(0)
  })

  test('a zero-value booking reads as Paid, not Pending', async ({ context, page }) => {
    // nothing owed means nothing to collect — it must not fall through to Pending
    await context.unroute('**/api/**')
    await stubApi(context, {
      bookings: [{
        id: 'z1', guestName: 'Comped Guest', guestEmail: '', guestPhone: '',
        checkIn: new Date().toISOString(), checkOut: new Date(Date.now() + 86_400_000).toISOString(),
        nights: 1, rate: 0, cleaningFee: 0, platformFee: 0,
        totalAmount: 0, netAmount: 0, paidAmount: 0,
        platform: 'DIRECT', status: 'CONFIRMED', propertyId: 'p1',
        property: { id: 'p1', name: 'Room 1' }, notes: '',
        hotelEyeStatus: 'NOT_ENTERED', miscCharges: 0,
      }],
    })

    await page.goto('/dashboard/bookings?view=all')
    await waitForData(page, 'Comped Guest')

    const card = row(page, 'Comped Guest')
    await expect(card.getByText('Paid', { exact: true })).toBeVisible()
    await expect(card.getByText('Pending', { exact: true })).toHaveCount(0)
  })
})
