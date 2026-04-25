import { defineConfig, devices } from '@playwright/test'
import { BASE_URL } from './integration/helpers'

export default defineConfig({
  testDir: './integration',
  outputDir: './integration/.output/test-results',
  timeout: 30 * 1000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: false,
  // These tests currently share a demo account and persisted OAuth state,
  // so run them in a single worker to avoid cross-test interference.
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
