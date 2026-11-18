import { createHash } from 'node:crypto'
import { defineConfig, devices } from '@playwright/test'

// Each checkout/worktree gets its own stable port so parallel runs (e.g. Epic
// Implementer children in separate worktrees) never test each other's server.
// Override with E2E_PORT.
const PORT =
  Number(process.env.E2E_PORT) ||
  3100 + (createHash('sha1').update(process.cwd()).digest().readUInt16BE(0) % 800)
const baseURL = `http://localhost:${PORT}`

// E2E tests run against a production build (`next build` + `next start`),
// as the Next.js Playwright guide recommends.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `npm run build && npm run start -- --port ${PORT}`,
    url: baseURL,
    // Always build and serve this checkout's code; set E2E_REUSE_SERVER=1 to
    // reuse a server you already started on E2E_PORT.
    reuseExistingServer: !!process.env.E2E_REUSE_SERVER,
    timeout: 180_000,
  },
})
