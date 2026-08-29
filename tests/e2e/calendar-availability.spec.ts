import { test, expect } from '@playwright/test'
import { signIn } from './helpers/session'
import { stubApi, waitForData } from './helpers/api'

test.describe('Calendar — room availability', () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await signIn(context, baseURL!)
    await stubApi(context)
  })

  test('lists every room, including ones with no booking that day', async ({ page }) => {
    await page.goto('/dashboard/calendar')
    await waitForData(page, 'Room Available')

    const rail = page.getByText('Scheduled', { exact: true }).locator('xpath=ancestor::div[3]')

    // Room 1 is occupied today — a booking card, not an availability card
    await expect(rail).toContainText('Fully Paid Guest')
    // Room 2 is free today — the case the rail used to omit entirely
    await expect(rail).toContainText('Room Available')
    // Room 3 is unbookable rather than free, and must say so
    await expect(rail).toContainText('Under maintenance')
    await expect(rail).toContainText('Not bookable')
  })

  test('offers a single New Booking button', async ({ page }) => {
    await page.goto('/dashboard/calendar')
    await waitForData(page, 'Room Available')

    // month view carries its own button in the rail; the page header no longer duplicates it
    await expect(page.getByRole('button', { name: /^New Booking$/i })).toHaveCount(1)
  })

  test('quick-booking dialog fits its date fields', async ({ page }) => {
    await page.goto('/dashboard/calendar')
    await waitForData(page, 'Room Available')

    await page.getByRole('button', { name: /^New Booking$/i }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    /* datetime-local has a wide intrinsic minimum. Grid cells default to
       min-width:auto, so at a narrow dialog width the control pushed the grid
       out and the native picker icon was clipped. */
    const layout = await dialog.evaluate((el) => {
      const fields = [...el.querySelectorAll('input[type="datetime-local"]')]
      return {
        dialogOverflows: el.scrollWidth > el.clientWidth + 1,
        clipped: fields.filter((f) => f.scrollWidth > f.clientWidth + 1).length,
        count: fields.length,
      }
    })

    expect(layout.count).toBe(2)
    expect(layout.clipped).toBe(0)
    expect(layout.dialogOverflows).toBe(false)
  })
})
