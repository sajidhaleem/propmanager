import { defineConfig, devices } from '@playwright/test'

/* Port is configurable because reuseExistingServer will happily adopt whatever
   is already listening — if another app holds 3000, the whole suite silently
   runs against it and every test fails with a 404 that looks like an app bug.
   Unset defaults to 3000, so CI is unaffected; locally use PORT=3210 etc. */
const PORT = process.env.PORT || '3000'
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`

export default defineConfig({
  testDir: './tests/e2e',
  /* The capture run writes screenshots and asserts almost nothing, so it stays
     out of the suite and is invoked by name when a visual change needs review:
       npx playwright test capture-preview --project=chromium */
  testIgnore: '**/capture-preview.spec.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } },
  ],
  webServer: {
    command: `npm run dev -- -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
})
