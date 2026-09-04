import { test, expect } from '@playwright/test'
import { signIn } from './helpers/session'
import { stubApi, waitForData } from './helpers/api'

/**
 * Bookings splits into two views off one page: the Hotel Eye list (stays with a
 * card on file) and All. The distinction is membership by identity, not by
 * filing status — a view that only showed filed guests would hide the overdue
 * ones, which is the opposite of what a compliance screen is for.
 */
test.describe('Bookings — Hotel Eye and All views', () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await signIn(context, baseURL!)
    await stubApi(context)
  })

  test('the Hotel Eye view keeps only stays with a card on file', async ({ page }) => {
    await page.goto('/dashboard/bookings?view=hoteleye')
    await waitForData(page, 'Fully Paid Guest')

    await expect(page.getByRole('heading', { name: 'Hotel Eye Bookings' })).toBeVisible()
    // the two fixtures with no CNIC or passport are not part of this view
    await expect(page.getByText('Half Paid Guest')).toHaveCount(0)
    await expect(page.getByText('Unpaid Guest')).toHaveCount(0)
  })

  test('the All view keeps every booking', async ({ page }) => {
    await page.goto('/dashboard/bookings?view=all')
    await waitForData(page, 'Half Paid Guest')

    await expect(page.getByRole('heading', { name: 'All Bookings' })).toBeVisible()
    await expect(page.getByText('Fully Paid Guest')).toBeVisible()
    await expect(page.getByText('Unpaid Guest')).toBeVisible()
  })

  test('scanning is no longer on the booking form — the guest picker replaces it', async ({ page }) => {
    await page.goto('/dashboard/bookings?view=all')
    await waitForData(page, 'Fully Paid Guest')

    await page.getByRole('button', { name: /New Booking/i }).first().click()

    await expect(page.getByPlaceholder(/Find a saved guest/i)).toBeVisible()
    // the scanners moved to the guest profile, so their controls must be gone
    await expect(page.getByText(/Scan CNIC/i)).toHaveCount(0)
  })
})
