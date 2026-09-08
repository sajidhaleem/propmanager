import { test, expect } from '@playwright/test'
import { signIn } from './helpers/session'
import { stubApi, waitForData, BOOKINGS } from './helpers/api'

/**
 * N/A — a stay that owes the portal no filing at all.
 *
 * It is the one filing status that removes a stay from the compliance figures
 * instead of advancing it through them, so it is handed out per user in
 * Settings rather than assumed from a role. The API is the control; hiding the
 * menu item is the courtesy. These specs pin the courtesy.
 */

const NA_BOOKINGS = BOOKINGS.map((b) =>
  b.id === 'b2' ? { ...b, hotelEyeStatus: 'NOT_APPLICABLE' } : b,
)

test.describe('Hotel Eye — N/A', () => {
  test('does not offer N/A to a user who has not been granted it', async ({ context, page, baseURL }) => {
    await signIn(context, baseURL!)
    await stubApi(context, { permissions: ['bookings'] })

    await page.goto('/dashboard/bookings?view=all')
    await waitForData(page, 'Half Paid Guest')

    // an unfiled row's control is labelled with its remaining window, e.g. "Due in 120h"
    await page.getByRole('combobox').filter({ hasText: /Due in/ }).first().click()
    await expect(page.getByRole('option', { name: 'Filed', exact: true })).toBeVisible()
    await expect(page.getByRole('option', { name: /N\/A/ })).toHaveCount(0)
  })

  test('offers N/A once an admin has granted it, and files nothing', async ({ context, page, baseURL }) => {
    await signIn(context, baseURL!)
    await stubApi(context, { permissions: ['bookings', 'hoteleye_na'] })

    await page.goto('/dashboard/bookings?view=all')
    await waitForData(page, 'Half Paid Guest')

    const patch = page.waitForRequest(
      (r) => r.method() === 'PATCH' && /\/api\/bookings\/b\d$/.test(r.url()),
    )

    // an unfiled row's control is labelled with its remaining window, e.g. "Due in 120h"
    await page.getByRole('combobox').filter({ hasText: /Due in/ }).first().click()
    await page.getByRole('option', { name: /N\/A/ }).click()

    // the status is recorded on the booking; nothing is queued with the portal
    expect((await patch).postDataJSON()).toEqual({ hotelEyeStatus: 'NOT_APPLICABLE' })
  })

  test('shows N/A on the stay rather than a filing that is still owed', async ({ context, page, baseURL }) => {
    await signIn(context, baseURL!)
    await stubApi(context, { bookings: NA_BOOKINGS, permissions: ['bookings', 'hoteleye_na'] })

    await page.goto('/dashboard/bookings?view=all')
    await waitForData(page, 'Half Paid Guest')

    await expect(page.getByRole('combobox').filter({ hasText: 'N/A' })).toHaveCount(1)
  })

  /* Membership of the Hotel Eye view is the filing itself. An N/A stay was
     never filed, so it does not belong there either — it is simply out of the
     record in both directions. */
  test('keeps an N/A stay out of the filed register', async ({ context, page, baseURL }) => {
    await signIn(context, baseURL!)
    await stubApi(context, { bookings: NA_BOOKINGS, permissions: ['bookings', 'hoteleye_na'] })

    await page.goto('/dashboard/bookings?view=hoteleye')
    await waitForData(page, 'Fully Paid Guest')

    await expect(page.getByText('Half Paid Guest')).toHaveCount(0)
  })
})
