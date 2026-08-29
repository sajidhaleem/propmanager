import { test, expect } from '@playwright/test'
import { signIn } from './helpers/session'
import { stubApi, waitForData } from './helpers/api'

/**
 * Every insight status used to be a hardcoded literal, so a month that lost
 * Rs 59,127 rendered a green "Excellent" margin, 85% occupancy (above its own
 * 70% target) showed amber "Needs Work", and 0% uncollected showed red
 * "Act immediately". The fixtures reproduce exactly that month.
 */
test.describe('Reports — insight grading', () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await signIn(context, baseURL!)
    await stubApi(context)
  })

  /** Each tile is a button: badge on the first line, title on the last. */
  const tileBadges = (page: import('@playwright/test').Page) =>
    page.evaluate(() =>
      Object.fromEntries(
        [...document.querySelectorAll('button')]
          .map((b) => b.innerText.trim().split(/\r?\n/).map((s) => s.trim()).filter(Boolean))
          .filter((lines) => lines.length >= 3)
          .map((lines) => [lines[lines.length - 1], lines[0]])
      )
    )

  test('grades a loss-making month as urgent, not excellent', async ({ page }) => {
    await page.goto('/dashboard/reports')
    await waitForData(page, 'Net Income')

    const badges = await tileBadges(page)
    expect(badges['Net Income']).toBe('Urgent')
    expect(badges['Monthly Expenses']).toBe('Urgent')
  })

  test('credits occupancy above target and clean collection', async ({ page }) => {
    await page.goto('/dashboard/reports')
    await waitForData(page, 'Net Income')

    const badges = await tileBadges(page)
    expect(badges['Occupancy Rate']).toBe('Excellent')       // 85% vs a 70% target
    expect(badges['Outstanding Balance']).toBe('Excellent')  // nothing uncollected

    await expect(page.getByText('Above 70% target')).toBeVisible()
    await expect(page.getByText('All bookings paid')).toBeVisible()
  })

  test('states the loss plainly and formats derived figures', async ({ page }) => {
    await page.goto('/dashboard/reports')
    await waitForData(page, 'Net Income')

    const body = await page.locator('body').innerText()
    expect(body).toMatch(/running at a loss/i)
    expect(body).not.toMatch(/is profitable at -/i)

    // a hardcoded "+" prefix used to render negative growth as "+-6%"
    expect(body).not.toContain('+-')
    // channel mix was a literal 94%; 72 of 87 direct bookings is 83%
    expect(body).not.toContain('94% of your')
  })
})
