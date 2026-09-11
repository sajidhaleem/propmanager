import { test, expect } from '@playwright/test'
import { signIn } from './helpers/session'
import { stubApi, waitForData, booking, BOOKINGS } from './helpers/api'

/* Room 2 is free today in the base fixtures. This adds a cancelled stay on it
   for today, which must change nothing: a cancelled booking releases the room. */
const WITH_CANCELLED = [
  ...BOOKINGS,
  booking('b9', 'Cancelled Guest', 'p2', 'Room 2', 'DIRECT', 'CANCELLED', 0, 0),
]

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

  /* Same register as the full booking form. A returning guest booked from the
     calendar must reach the same profile, or the quick path quietly becomes the
     one that makes duplicates. */
  /* A cancelled stay releases the room. It has to release it everywhere the
     desk looks, not only where the occupancy maths happens to filter. */
  test('a cancelled booking leaves the room free', async ({ context, page, baseURL }) => {
    await signIn(context, baseURL!)
    await stubApi(context, { bookings: WITH_CANCELLED })

    await page.goto('/dashboard/calendar')
    await waitForData(page, 'Room Available')

    const rail = page.getByText('Scheduled', { exact: true }).locator('xpath=ancestor::div[3]')
    // Room 2 is still offered, not held by the guest whose booking was cancelled
    await expect(rail).toContainText('Room Available')
    await expect(rail).toContainText('No booking this day')

    /* No arrival card for a cancelled stay. Scoped to the card rather than the
       panel's text, because the month grid alongside it deliberately keeps
       showing cancelled bookings — that view is the record of what was booked,
       and its own legend lists Cancelled. */
    await expect(page.getByRole('link', { name: /Cancelled Guest/ })).toHaveCount(0)
  })

  test('a cancelled booking does not take a room out of the day count', async ({ context, page, baseURL }) => {
    await signIn(context, baseURL!)
    await stubApi(context, { bookings: WITH_CANCELLED })

    await page.goto('/dashboard/calendar')
    await waitForData(page, 'Room Available')

    /* Three rooms, one occupied by a live stay and one under maintenance, so
       exactly one is free — the cancelled stay must not make it zero. */
    await expect(page.getByText('1 of 3 free')).toBeVisible()
  })

  test('the quick dialog searches saved guests by name', async ({ page }) => {
    await page.goto('/dashboard/calendar')
    await waitForData(page, 'Room Available')

    await page.getByRole('button', { name: /^New Booking$/i }).click()
    const nameField = page.getByRole('combobox', { name: 'Guest name' })
    await nameField.fill('Hamza')

    await expect(page.getByRole('button', { name: /Hamza Naeem/ })).toBeVisible()
    // the identity is shown, so the right Hamza can be told from another
    await expect(page.getByText('35202-1234567-1')).toBeVisible()
  })

  test('a picked guest is linked, and their identity rides along', async ({ page }) => {
    await page.goto('/dashboard/calendar')
    await waitForData(page, 'Room Available')

    await page.getByRole('button', { name: /^New Booking$/i }).click()
    const nameField = page.getByRole('combobox', { name: 'Guest name' })
    await nameField.fill('Hamza')
    await page.getByRole('button', { name: /Hamza Naeem/ }).click()

    await expect(nameField).toHaveValue('Hamza Naeem')
    await expect(page.getByRole('button', { name: /Unlink this booking/i })).toBeVisible()

    /* The dialog shows no CNIC field, but the booking must still carry one:
       a stay taken here is filed on the portal like any other. */
    const post = page.waitForRequest(
      (r) => r.method() === 'POST' && r.url().endsWith('/api/bookings'),
    )
    await page.getByRole('combobox').filter({ hasText: 'Pick a room' }).click()
    await page.getByRole('option', { name: 'Room 2' }).click()
    await page.getByRole('button', { name: /Create Booking/i }).click()

    expect((await post).postDataJSON()).toMatchObject({
      guestId: 'g1',
      guestName: 'Hamza Naeem',
      guestCnic: '35202-1234567-1',
      guestPhone: '03071130001',
    })
  })
})
