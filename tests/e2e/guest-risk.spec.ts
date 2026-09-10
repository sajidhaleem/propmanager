import { test, expect } from '@playwright/test'
import { signIn } from './helpers/session'
import { stubApi, waitForData } from './helpers/api'

/**
 * Do-not-book flags.
 *
 * The flag exists to change a decision a person is about to make, so what these
 * specs pin is where it appears and what it refuses to do: it warns at the
 * moment of booking, it never blocks the form, and setting one is not something
 * every account can do.
 */
test.describe('Guest — do-not-book flag', () => {
  const openBookingForm = async (page: import('@playwright/test').Page) => {
    await page.goto('/dashboard/bookings?view=all')
    await waitForData(page, 'Fully Paid Guest')
    await page.getByRole('button', { name: /New Booking/i }).first().click()
    return page.getByRole('combobox', { name: 'Guest name' })
  }

  test('shows the flag in the search results, before the guest is picked', async ({ context, page, baseURL }) => {
    await signIn(context, baseURL!)
    await stubApi(context, { permissions: ['bookings', 'guests'] })

    const nameField = await openBookingForm(page)
    await nameField.fill('Bilal')

    const row = page.getByRole('button', { name: /Bilal Flagged/ })
    await expect(row).toBeVisible()
    await expect(row).toContainText('Do not book')
  })

  test('warns on the booking form once a flagged guest is linked', async ({ context, page, baseURL }) => {
    await signIn(context, baseURL!)
    await stubApi(context, { permissions: ['bookings', 'guests'] })

    const nameField = await openBookingForm(page)
    await nameField.fill('Bilal')
    await page.getByRole('button', { name: /Bilal Flagged/ }).click()

    const notice = page.getByRole('alert').filter({ hasText: 'Do not book' })
    await expect(notice).toBeVisible()
    // the grounds travel with the warning, so the desk can weigh it
    await expect(notice).toContainText('Left without settling the bill')
    await expect(notice).toContainText('Rs 12,000 unpaid')
  })

  /* A warning, not a bar. An automatic refusal is the shape a discrimination
     complaint needs, and a desk that cannot override just retypes the name
     slightly differently — which costs the property the record as well. */
  test('warns without blocking the booking', async ({ context, page, baseURL }) => {
    await signIn(context, baseURL!)
    await stubApi(context, { permissions: ['bookings', 'guests'] })

    const nameField = await openBookingForm(page)
    await nameField.fill('Bilal')
    await page.getByRole('button', { name: /Bilal Flagged/ }).click()

    await expect(page.getByRole('alert').filter({ hasText: 'Do not book' })).toBeVisible()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('button', { name: 'Create', exact: true })).toBeEnabled()
  })

  test('an unflagged guest gets no warning at all', async ({ context, page, baseURL }) => {
    await signIn(context, baseURL!)
    await stubApi(context, { permissions: ['bookings', 'guests'] })

    const nameField = await openBookingForm(page)
    await nameField.fill('Hamza')
    await page.getByRole('button', { name: /Hamza Naeem/ }).click()

    await expect(page.getByText('Do not book')).toHaveCount(0)
    await expect(page.getByText('Caution', { exact: true })).toHaveCount(0)
  })

  test('the profile states the flag, who set it, and when it is reviewed', async ({ context, page, baseURL }) => {
    await signIn(context, baseURL!)
    await stubApi(context, { permissions: ['guests', 'guest_risk'] })

    await page.goto('/dashboard/guests/g3')
    await waitForData(page, 'Bilal Flagged')

    await expect(page.getByText('Decline unless a manager approves it.')).toBeVisible()
    await expect(page.getByText('Left without settling the bill')).toBeVisible()
    await expect(page.getByText(/Set by Sajid/)).toBeVisible()
    await expect(page.getByText(/Review by/)).toBeVisible()
  })

  /* Seeing a flag and setting one are different things: a warning nobody is
     shown is pointless, but refusing someone a room is a commercial decision
     handed out by name. */
  test('only a granted user is offered the controls', async ({ context, page, baseURL }) => {
    await signIn(context, baseURL!)
    await stubApi(context, { permissions: ['guests'] })

    await page.goto('/dashboard/guests/g3')
    await waitForData(page, 'Bilal Flagged')

    // the warning is still there for everyone
    await expect(page.getByText('Decline unless a manager approves it.')).toBeVisible()
    // the controls are not
    await expect(page.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Lift', exact: true })).toHaveCount(0)
  })

  test('the flag dialog says what may not be written in the note', async ({ context, page, baseURL }) => {
    await signIn(context, baseURL!)
    await stubApi(context, { permissions: ['guests', 'guest_risk'] })

    await page.goto('/dashboard/guests/g3')
    await waitForData(page, 'Bilal Flagged')
    await page.getByRole('button', { name: 'Edit', exact: true }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText(/religion, sect, ethnicity, nationality, marital status or appearance/i)
    await expect(dialog).toContainText(/not a life sentence/i)
  })
})
