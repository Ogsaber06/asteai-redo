import { defineConfig, devices } from '@playwright/test';

/**
 * Accessibility + CSP smoke suite for the public pages (e2e/a11y.spec.ts).
 *
 *   bun run build            # the suite runs against the production server (real CSP headers)
 *   bun run test:a11y
 *
 * The API doesn't need to be running: public pages render their fallbacks, which must be
 * accessible too. Set E2E_BASE_URL to test a deployed environment instead.
 */
const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 60_000,
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'light', use: { ...devices['Desktop Chrome'], colorScheme: 'light' } },
    { name: 'dark', use: { ...devices['Desktop Chrome'], colorScheme: 'dark' } },
  ],
  webServer: process.env.E2E_BASE_URL ? undefined : {
    // Through node, so it works on Windows shells without node_modules/.bin on PATH.
    command: `node node_modules/next/dist/bin/next start -p ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
