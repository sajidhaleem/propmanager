import { test, expect } from '@playwright/test'
import { signIn } from './helpers/session'
import { stubApi, waitForData } from './helpers/api'

/**
 * Regression: the custom-platform box was rendered under
 * `platform === 'OTHER' && !platformOther`, so the first keystroke made
 * platformOther truthy and unmounted the input mid-typing. The Select
 * compounded it by taking an `OTHER:<typed text>` value that matched no item,
 * blanking the trigger.
 */
test.describe('Booking form — custom platform', () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await signIn(context, baseURL!)
    await stubApi(context)
  })

  test('accepts a full custom platform name without the field vanishing', async ({ page }) => {
    await page.goto('/dashboard/bookings?view=all')
    await waitForData(page, 'Fully Paid Guest')

    await page.getByRole('button', { name: /New Booking/i }).first().click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    const platform = dialog.getByRole('combobox').filter({ hasText: /Direct|Airbnb|Other/ }).first()
    await platform.click()
    await page.getByRole('option', { name: 'Other', exact: true }).click()

    const custom = page.getByPlaceholder(/Facebook, Walk-in/i)
    await expect(custom).toBeVisible()

    // one character at a time: filling in one shot would mask a mid-typing unmount
    await custom.click()
    for (const ch of 'Facebook') await page.keyboard.type(ch, { delay: 30 })

    await expect(custom).toBeVisible()
    await expect(custom).toHaveValue('Facebook')
    // the dropdown must keep showing a label rather than going blank
    await expect(platform).not.toHaveText('')
  })

  test('recovers an existing custom label into its own field when editing', async ({ page }) => {
    await page.goto('/dashboard/bookings?view=all')
    await waitForData(page, 'Unpaid Guest')

    // b3 is platform OTHER with notes "[Walk-in] cash on arrival"
    await page.getByRole('button', { name: 'Edit', exact: true }).nth(2).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    // the label belongs in the platform field, not left buried in notes
    await expect(page.getByPlaceholder(/Facebook, Walk-in/i)).toHaveValue('Walk-in')
    await expect(dialog.getByText('[Walk-in]', { exact: false })).toHaveCount(0)
  })
})
