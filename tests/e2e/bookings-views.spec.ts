import { test, expect } from '@playwright/test'
import { signIn } from './helpers/session'
import { stubApi, waitForData } from './helpers/api'

/**
 * Bookings splits into two views off one page: the Hotel Eye list — the
 * register of what is actually on the portal — and All.
 *
 * Because membership is the filing itself, the Hotel Eye view cannot show
 * exposure: an overdue guest is by definition absent from it. The day banner
 * carries that job instead, and these specs pin it to the All view.
 */
test.describe('Bookings — Hotel Eye and All views', () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await signIn(context, baseURL!)
    await stubApi(context)
  })

  test('the Hotel Eye view keeps only stays already filed on the portal', async ({ page }) => {
    await page.goto('/dashboard/bookings?view=hoteleye')
    await waitForData(page, 'Fully Paid Guest')

    await expect(page.getByRole('heading', { name: 'Hotel Eye Bookings' })).toBeVisible()
    // the two unfiled fixtures are not part of this view, CNIC or no CNIC
    await expect(page.getByText('Half Paid Guest')).toHaveCount(0)
    await expect(page.getByText('Unpaid Guest')).toHaveCount(0)
  })

  /* Filtering by filing status inside a view where everything is filed could
     only ever narrow to nothing, so the control is not offered there. */
  test('drops the filing-status filter in the Hotel Eye view', async ({ page }) => {
    await page.goto('/dashboard/bookings?view=hoteleye')
    await waitForData(page, 'Fully Paid Guest')
    await expect(page.getByText('All Hotel Eye')).toHaveCount(0)

    await page.goto('/dashboard/bookings?view=all')
    await waitForData(page, 'Half Paid Guest')
    await expect(page.getByText('All Hotel Eye')).toBeVisible()
  })

  test('the All view keeps every booking', async ({ page }) => {
    await page.goto('/dashboard/bookings?view=all')
    await waitForData(page, 'Half Paid Guest')

    await expect(page.getByRole('heading', { name: 'All Bookings' })).toBeVisible()
    await expect(page.getByText('Fully Paid Guest')).toBeVisible()
    await expect(page.getByText('Unpaid Guest')).toBeVisible()
  })

  test('opens on the Hotel Eye view when no view is asked for', async ({ page }) => {
    await page.goto('/dashboard/bookings')
    await waitForData(page, 'Fully Paid Guest')

    await expect(page.getByRole('heading', { name: 'Hotel Eye Bookings' })).toBeVisible()
    await expect(page.getByText('Half Paid Guest')).toHaveCount(0)
  })

  test('the title switches between the two views', async ({ page }) => {
    await page.goto('/dashboard/bookings')
    await waitForData(page, 'Fully Paid Guest')

    await page.getByRole('button', { name: 'Hotel Eye Bookings' }).click()
    await page.getByRole('menuitem', { name: /All Bookings/ }).click()

    await expect(page).toHaveURL(/view=all/)
    await waitForData(page, 'Half Paid Guest')
    await expect(page.getByRole('heading', { name: 'All Bookings' })).toBeVisible()
  })

  test('scanning is no longer on the booking form — the guest picker replaces it', async ({ page }) => {
    await page.goto('/dashboard/bookings?view=all')
    await waitForData(page, 'Fully Paid Guest')

    await page.getByRole('button', { name: /New Booking/i }).first().click()

    await expect(page.getByPlaceholder(/Type to search saved guests/i)).toBeVisible()
    // the scanners moved to the guest profile, so their controls must be gone
    await expect(page.getByText(/Scan CNIC/i)).toHaveCount(0)
  })
})
