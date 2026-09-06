import { test, expect } from '@playwright/test'
import { signIn } from './helpers/session'
import { stubApi, waitForData } from './helpers/api'

/**
 * Not a test: a capture run. Screenshots every main surface so a visual change
 * can be reviewed as pictures rather than as a description of pictures.
 *
 * Runs against the fixtures rather than the real database so the shots are
 * stable between runs and carry no guest identity into an image file.
 *
 *   npx playwright test capture-preview --project=chromium
 */

const OUT = 'preview'

test.describe.configure({ timeout: 120_000, mode: 'serial' })

test.use({ viewport: { width: 1440, height: 900 } })

test.describe('preview capture', () => {
  test.beforeEach(async ({ context, baseURL, page }) => {
    await signIn(context, baseURL!)
    await stubApi(context)
    // The identity is the dark one; next-themes reads this before first paint
    await context.addInitScript(() => {
      try { localStorage.setItem('theme', 'dark') } catch { /* private mode */ }
    })
    await page.emulateMedia({ reducedMotion: 'reduce' })
  })

  const shot = async (page: import('@playwright/test').Page, name: string) => {
    // let the entry transitions settle so nothing is caught mid-fade
    await page.waitForTimeout(700)
    await page.screenshot({ path: `${OUT}/${name}.png`, animations: 'disabled' })
  }

  test('dashboard', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForTimeout(2500)
    await shot(page, '01-dashboard')
  })

  test('bookings', async ({ page }) => {
    await page.goto('/dashboard/bookings?view=all')
    await waitForData(page, 'Fully Paid Guest')
    await shot(page, '02-bookings')
  })

  test('new booking dialog', async ({ page }) => {
    await page.goto('/dashboard/bookings?view=all')
    await waitForData(page, 'Fully Paid Guest')
    await page.getByRole('button', { name: /New Booking/i }).first().click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await shot(page, '03-booking-dialog')
  })

  test('guests list', async ({ page }) => {
    await page.goto('/dashboard/guests')
    await waitForData(page, 'Hamza Naeem')
    await shot(page, '04-guests')
  })

  test('guest profile board', async ({ page }) => {
    await page.goto('/dashboard/guests/g1')
    await waitForData(page, 'Hamza Naeem')
    await shot(page, '05-guest-profile')
  })

  test('guest edit dialog', async ({ page }) => {
    await page.goto('/dashboard/guests')
    await waitForData(page, 'Hamza Naeem')
    await page.getByRole('button', { name: 'Edit Hamza Naeem' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await shot(page, '06-guest-dialog')
  })

  test('calendar', async ({ page }) => {
    await page.goto('/dashboard/calendar')
    await page.waitForTimeout(2500)
    await shot(page, '07-calendar')
  })

  test('reports', async ({ page }) => {
    await page.goto('/dashboard/reports')
    await page.waitForTimeout(3000)
    await shot(page, '08-reports')
  })

  /* The light counterpart, so the theme toggle can be judged rather than
     assumed. If the product is dark only, this is the shot that says so. */
  test('dashboard in light', async ({ page, context }) => {
    await context.addInitScript(() => {
      try { localStorage.setItem('theme', 'light') } catch { /* private mode */ }
    })
    await page.goto('/dashboard')
    await page.waitForTimeout(2500)
    await shot(page, '09-dashboard-light')
  })
})
