import { defineConfig, devices } from '@playwright/test';

/**
 * Browser tests (work plan: "Playwright: end-to-end scenarios, frame rate and
 * browser compatibility"). They run against the production build, served
 * with the same /circuitmaker/ base path as GitHub Pages.
 */
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173/circuitmaker/',
    // the first-visit tour would cover the page; it has its own test
    storageState: 'e2e/fixtures/tour-seen.json',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/circuitmaker/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    // the phone layout is checked only on the iPhone project
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: /mobile\.spec\.ts/ },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] }, testIgnore: /mobile\.spec\.ts/ },
    { name: 'webkit', use: { ...devices['Desktop Safari'] }, testIgnore: /mobile\.spec\.ts/ },
    {
      name: 'iphone',
      use: { ...devices['iPhone 14'] },
      testMatch: /mobile\.spec\.ts/,
    },
  ],
});
