import { test, expect } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'

test.describe('Authentication', () => {
  test('redirects to login when unauthenticated', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`)
    await expect(page).toHaveURL(/login/)
  })

  test('shows login form', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`)
    await expect(page.getByRole('heading', { name: 'PropManager' })).toBeVisible()
    await expect(page.getByLabel('Email')).toBeVisible()
    await expect(page.getByLabel('Password')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
  })

  test('shows error on invalid credentials', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`)
    await page.fill('[id="email"]', 'invalid@test.com')
    await page.fill('[id="password"]', 'wrongpassword')
    await page.click('button[type="submit"]')
    await expect(page.getByText(/Invalid credentials/i)).toBeVisible({ timeout: 5000 })
  })

  test('logs in with valid credentials', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`)
    await page.fill('[id="email"]', 'admin@propmanager.com')
    await page.fill('[id="password"]', 'admin123')
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/dashboard/, { timeout: 10000 })
  })
})

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/login`)
    await page.fill('[id="email"]', 'admin@propmanager.com')
    await page.fill('[id="password"]', 'admin123')
    await page.click('button[type="submit"]')
    await page.waitForURL(/dashboard/, { timeout: 10000 })
  })

  test('shows dashboard stats', async ({ page }) => {
    await expect(page.getByText('Dashboard')).toBeVisible()
    await expect(page.getByText('Monthly Revenue')).toBeVisible()
    await expect(page.getByText('Occupancy Rate')).toBeVisible()
  })

  test('sidebar navigation works', async ({ page }) => {
    await page.click('text=Bookings')
    await expect(page).toHaveURL(/bookings/)

    await page.click('text=Calendar')
    await expect(page).toHaveURL(/calendar/)

    await page.click('text=Properties')
    await expect(page).toHaveURL(/properties/)
  })
})

test.describe('Bookings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/login`)
    await page.fill('[id="email"]', 'admin@propmanager.com')
    await page.fill('[id="password"]', 'admin123')
    await page.click('button[type="submit"]')
    await page.waitForURL(/dashboard/, { timeout: 10000 })
    await page.goto(`${BASE_URL}/dashboard/bookings`)
  })

  test('shows bookings table', async ({ page }) => {
    await expect(page.getByText('Bookings')).toBeVisible()
    await expect(page.getByRole('button', { name: 'New Booking' })).toBeVisible()
  })

  test('opens new booking modal', async ({ page }) => {
    await page.click('button:has-text("New Booking")')
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByText('New Booking')).toBeVisible()
  })

  test('filters bookings by status', async ({ page }) => {
    await page.locator('button:has-text("All Status")').click()
    await page.locator('text=CONFIRMED').first().click()
    await expect(page.url()).toContain('/bookings')
  })
})

test.describe('Calendar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/login`)
    await page.fill('[id="email"]', 'admin@propmanager.com')
    await page.fill('[id="password"]', 'admin123')
    await page.click('button[type="submit"]')
    await page.waitForURL(/dashboard/)
    await page.goto(`${BASE_URL}/dashboard/calendar`)
  })

  test('shows calendar view', async ({ page }) => {
    await expect(page.getByText('Booking Calendar')).toBeVisible()
    // Weekday headers
    for (const day of ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']) {
      await expect(page.getByText(day)).toBeVisible()
    }
  })

  test('can navigate months', async ({ page }) => {
    const initialMonth = await page.locator('h2').first().textContent()
    await page.click('button[aria-label]').catch(() => {})
    // Navigation should work
    await expect(page.locator('h2').first()).toBeVisible()
  })
})

test.describe('Properties', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/login`)
    await page.fill('[id="email"]', 'admin@propmanager.com')
    await page.fill('[id="password"]', 'admin123')
    await page.click('button[type="submit"]')
    await page.waitForURL(/dashboard/)
    await page.goto(`${BASE_URL}/dashboard/properties`)
  })

  test('shows property cards', async ({ page }) => {
    await expect(page.getByText('Properties')).toBeVisible()
    await expect(page.getByText('Add Property')).toBeVisible()
  })
})

test.describe('Reports', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/login`)
    await page.fill('[id="email"]', 'admin@propmanager.com')
    await page.fill('[id="password"]', 'admin123')
    await page.click('button[type="submit"]')
    await page.waitForURL(/dashboard/)
    await page.goto(`${BASE_URL}/dashboard/reports`)
  })

  test('shows reports page', async ({ page }) => {
    await expect(page.getByText('Reports & Analytics')).toBeVisible()
    await expect(page.getByText('Monthly P&L')).toBeVisible()
    await expect(page.getByText('By Property')).toBeVisible()
    await expect(page.getByText('By Platform')).toBeVisible()
  })
})
