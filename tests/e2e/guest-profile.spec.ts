import { test, expect } from '@playwright/test'
import { signIn } from './helpers/session'
import { stubApi, waitForData } from './helpers/api'

/**
 * The guest profile board. Its whole reason for existing is that the desk can
 * see, without clicking anything, who this guest is and whether they can be
 * filed — so the scanned card and the missing-field list are what these specs
 * hold on to.
 */
/* The board and the booking form are both routes the dev server compiles on
   first navigation, which alone can eat the default budget. */
test.describe.configure({ timeout: 90_000 })

test.describe('Guest profile board', () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await signIn(context, baseURL!)
    await stubApi(context)
  })

  test('shows the scanned card, not an avatar, and keeps it in view', async ({ page }) => {
    await page.goto('/dashboard/guests/g1')
    await waitForData(page, 'Hamza Naeem')

    const card = page.getByRole('img', { name: /Scanned CNIC for Hamza Naeem/i })
    await expect(card).toBeVisible()
    // the image is the real bytes from our own API, not a placeholder
    await expect(card).toHaveJSProperty('naturalWidth', 1)

    /* "Always visible" is the requirement: the card column is sticky, so
       scrolling the board must not carry it off the screen. */
    await page.mouse.wheel(0, 2000)
    await expect(card).toBeInViewport()
  })

  test('names the tiles for this application, not for an HR dashboard', async ({ page }) => {
    await page.goto('/dashboard/guests/g1')
    await waitForData(page, 'Hamza Naeem')

    for (const tile of ['Nights stayed', 'Filing window', 'Profile completeness', 'Filing checklist']) {
      await expect(page.getByText(tile, { exact: true })).toBeVisible()
    }
  })

  /* A guest who cannot be filed is the situation the board exists to catch, so
     the checklist has to say which field is missing rather than a bare score. */
  test('calls out the fields a filing is still missing', async ({ page }) => {
    await page.goto('/dashboard/guests/g2')
    await waitForData(page, 'Nadia Visitor')

    await expect(page.getByLabel('Card image missing')).toBeVisible()
    await expect(page.getByLabel("Father's name missing")).toBeVisible()
    // the passport counts as the document, so that row is satisfied
    await expect(page.getByLabel('CNIC or passport recorded')).toBeVisible()
  })

  test('offers a scan when no card has been taken', async ({ page }) => {
    await page.goto('/dashboard/guests/g2')
    await waitForData(page, 'Nadia Visitor')

    await expect(page.getByText('No card scanned yet')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Scan now' })).toBeVisible()
  })

  test('the guest list opens the board by name', async ({ page }) => {
    await page.goto('/dashboard/guests')
    await waitForData(page, 'Hamza Naeem')

    await page.getByRole('link', { name: 'Hamza Naeem' }).click()
    // generous: the dev server compiles the profile route on first navigation
    await page.waitForURL(/\/dashboard\/guests\/g1/, { timeout: 60_000 })
  })
})

/**
 * The booking form's guest name is the saved register, searched as it is typed.
 * Picking a profile is what stops one person becoming three spellings.
 */
test.describe('Booking — searchable guest name', () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await signIn(context, baseURL!)
    await stubApi(context)
  })

  const openForm = async (page: import('@playwright/test').Page) => {
    await page.goto('/dashboard/bookings?view=all')
    await waitForData(page, 'Fully Paid Guest')
    await page.getByRole('button', { name: /New Booking/i }).first().click()
    return page.getByRole('combobox', { name: 'Guest name' })
  }

  test('searches saved guests as the name is typed', async ({ page }) => {
    const nameField = await openForm(page)
    await nameField.fill('Hamza')

    await expect(page.getByRole('button', { name: /Hamza Naeem/ })).toBeVisible()
    // the identity on the profile is shown, so the right Hamza can be picked
    await expect(page.getByText('35202-1234567-1')).toBeVisible()
  })

  test('picking a guest links the booking and fills their details', async ({ page }) => {
    const nameField = await openForm(page)
    await nameField.fill('Hamza')
    await page.getByRole('button', { name: /Hamza Naeem/ }).click()

    await expect(nameField).toHaveValue('Hamza Naeem')
    await expect(page.getByRole('button', { name: /Unlink this booking/i })).toBeVisible()
    await expect(page.getByPlaceholder('+92 300 0000000')).toHaveValue('03071130001')
  })

  /* A desk must never be blocked from taking a booking because the profile does
     not exist yet — an unmatched name is accepted exactly as typed. */
  test('accepts a name that matches no saved guest', async ({ page }) => {
    const nameField = await openForm(page)
    await nameField.fill('Someone Entirely New')

    await expect(page.getByText(/will be booked as typed/i)).toBeVisible()
    await expect(nameField).toHaveValue('Someone Entirely New')
  })
})
