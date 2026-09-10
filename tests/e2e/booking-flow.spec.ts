import { test, expect } from '@playwright/test'
import { signIn } from './helpers/session'
import { stubApi, waitForData } from './helpers/api'

/**
 * The app's smoke pass: every main screen renders, and navigation reaches it.
 *
 * These used to log in through the form with seeded credentials, which meant
 * twelve tests failed together whenever the seed drifted, the local database
 * was unreachable, or the auth page changed — none of which is what any of
 * them were meant to be watching. Everything past the login page now mints a
 * session cookie and serves the API from fixtures, like the rest of the suite.
 */

test.describe('Authentication', () => {
  test('redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/login/)
  })

  test('shows login form', async ({ page }) => {
    await page.goto('/login')
    // the branding panel is desktop-only, so assert on the form itself
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
    await expect(page.getByLabel('Email address')).toBeVisible()
    await expect(page.getByLabel('Password')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
  })

  /* Whether a password is right is the API's judgement and is tested there.
     What the browser owns is showing the refusal, so the rejection is served
     from a route — a real credential check here would only re-test the seed. */
  test('surfaces a rejected sign-in', async ({ page }) => {
    await page.route('**/api/auth/login', (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'Invalid email or password' }),
      }),
    )

    await page.goto('/login')
    await page.getByLabel('Email address').fill('invalid@test.com')
    await page.getByLabel('Password').fill('wrongpassword')
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page.getByText('Invalid email or password')).toBeVisible()
    await expect(page).toHaveURL(/login/)
  })
})

test.describe('Main screens', () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await signIn(context, baseURL!)
    await stubApi(context)
  })

  test('the dashboard leads with the month and the filing position', async ({ page }) => {
    await page.goto('/dashboard')
    await waitForData(page, 'Net income')

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Good (morning|afternoon|evening)/)
    await expect(page.getByText('Net income', { exact: true })).toBeVisible()
    await expect(page.getByText('Occupancy', { exact: true })).toBeVisible()
    await expect(page.getByText('Total Bookings', { exact: true })).toBeVisible()
  })

  /* The sidebar is desktop-only and the bottom bar is its mobile counterpart;
     both carry these two, so one spec covers whichever is on screen. */
  test('navigation reaches bookings and the calendar', async ({ page }) => {
    await page.goto('/dashboard')
    await waitForData(page, 'Net income')

    /* Generous timeouts, because these are client-side navigations rather than
       page.goto: under `next dev` the first request for a route compiles it on
       demand, and the URL does not change until that finishes. Five seconds is
       not enough for a cold route, and the wait is the dev server's, not the
       app's. */
    await page.getByRole('link', { name: 'Bookings', exact: true }).click()
    await expect(page).toHaveURL(/bookings/, { timeout: 60_000 })

    await page.getByRole('link', { name: 'Calendar', exact: true }).click()
    await expect(page).toHaveURL(/calendar/, { timeout: 60_000 })
  })

  test('shows the bookings table', async ({ page }) => {
    await page.goto('/dashboard/bookings')
    await waitForData(page, 'Fully Paid Guest')

    await expect(page.getByRole('heading', { name: 'Hotel Eye Bookings' })).toBeVisible()
    await expect(page.getByRole('button', { name: /New Booking/i }).first()).toBeVisible()
  })

  test('opens the new booking modal', async ({ page }) => {
    await page.goto('/dashboard/bookings')
    await waitForData(page, 'Fully Paid Guest')

    await page.getByRole('button', { name: /New Booking/i }).first().click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('New Booking')).toBeVisible()
  })

  /* The old version of this only asserted that the URL still said /bookings,
     which it did before the click as well. Assert the list actually narrows. */
  test('filters bookings by status', async ({ page }) => {
    await page.goto('/dashboard/bookings?view=all')
    await waitForData(page, 'Half Paid Guest')

    await page.getByRole('combobox').filter({ hasText: 'All Status' }).click()
    await page.getByRole('option', { name: 'CHECKED IN' }).click()

    await waitForData(page, 'Fully Paid Guest')
    await expect(page.getByText('Half Paid Guest')).toHaveCount(0)
  })

  test('shows the calendar', async ({ page }) => {
    await page.goto('/dashboard/calendar')
    await waitForData(page, 'Room 1')

    await expect(page.getByRole('heading', { name: 'Calendar', level: 1 })).toBeVisible()
    await expect(page.getByText('Wed', { exact: true })).toBeVisible()
  })

  test('shows property cards', async ({ page }) => {
    await page.goto('/dashboard/properties')
    await waitForData(page, 'Room 1')

    await expect(page.getByRole('heading', { name: 'Properties', level: 1 })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Add Property' }).first()).toBeVisible()
  })

  test('shows the reports tabs', async ({ page }) => {
    await page.goto('/dashboard/reports')

    await expect(page.getByRole('heading', { name: 'Reports & Analytics', level: 1 })).toBeVisible()
    for (const tab of ['Insights', 'P&L Report', 'Monthly Overview', 'By Property', 'By Platform']) {
      await expect(page.getByRole('tab', { name: tab })).toBeVisible()
    }
  })
})
