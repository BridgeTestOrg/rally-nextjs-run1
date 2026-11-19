import { defineConfig, devices } from '@playwright/test'

/** Repo-root relative database for the default app server. */
export const DEFAULT_E2E_DB_PATH = 'test-results/e2e/default/rally.db'

/** Repo-root relative database for the waitlist app server. */
export const WAITLIST_E2E_DB_PATH = 'test-results/e2e/waitlist/rally.db'

const RALLY_NOW = '2026-11-17T17:40:00-07:00'

// E2E_PORT and E2E_STUB_PORT move the servers when the defaults are taken, for
// example when several worktrees run at once. Each scenario takes the next port
// after them.
const DEFAULT_PORT = Number(process.env.E2E_PORT) || 3100
const WAITLIST_PORT = DEFAULT_PORT + 1
const STUB_PORT = Number(process.env.E2E_STUB_PORT) || 4010

const reuseExistingServer = !process.env.CI

const WEATHER_SCENARIOS = [
  'weather-slow',
  'weather-timeout',
  'weather-fail-one',
  'weather-fail-all',
].map((name, index) => ({
  name,
  appPort: WAITLIST_PORT + 1 + index,
  stubPort: STUB_PORT + 1 + index,
}))

function stubServer(port: number, scenario: string) {
  return {
    command: 'node e2e/weather-stub.mjs',
    url: `http://127.0.0.1:${port}/healthz`,
    reuseExistingServer,
    timeout: 15_000,
    env: { STUB_PORT: String(port), STUB_SCENARIO: scenario },
  }
}

function appServer(port: number, stubPort: number, databasePath: string) {
  return {
    command: `node e2e/reset-db.mjs && npx next start -p ${port}`,
    // A static file, so readiness never renders a page or reads the weather.
    url: `http://127.0.0.1:${port}/favicon.ico`,
    reuseExistingServer,
    timeout: 60_000,
    env: {
      RALLY_NOW,
      WEATHER_URL: `http://127.0.0.1:${stubPort}`,
      DATABASE_PATH: databasePath,
    },
  }
}

// Tests run against a production build. `npm run test:e2e` builds first, and CI
// builds in an earlier step, so no web server builds.
export default defineConfig({
  testDir: './e2e',
  // Kept apart from test-results/e2e, which holds the servers' databases.
  outputDir: 'test-results/artifacts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : 'list',
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'default',
      testIgnore: ['**/*.weather-*.spec.ts', '**/*.waitlist.spec.ts'],
      metadata: { stubURL: `http://127.0.0.1:${STUB_PORT}` },
      use: {
        ...devices['Desktop Chrome'],
        baseURL: `http://127.0.0.1:${DEFAULT_PORT}`,
      },
    },
    {
      name: 'waitlist',
      testMatch: '**/*.waitlist.spec.ts',
      workers: 1,
      retries: 0,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: `http://127.0.0.1:${WAITLIST_PORT}`,
      },
    },
    // One worker each: specs read the stub's hit counters and the app's cache,
    // which every test in a scenario shares.
    ...WEATHER_SCENARIOS.map(({ name, appPort, stubPort }) => ({
      name,
      testMatch: `**/*.${name}.spec.ts`,
      workers: 1,
      retries: 0,
      metadata: { stubURL: `http://127.0.0.1:${stubPort}` },
      use: {
        ...devices['Desktop Chrome'],
        baseURL: `http://127.0.0.1:${appPort}`,
      },
    })),
  ],
  webServer: [
    stubServer(STUB_PORT, 'ok'),
    appServer(DEFAULT_PORT, STUB_PORT, DEFAULT_E2E_DB_PATH),
    appServer(WAITLIST_PORT, STUB_PORT, WAITLIST_E2E_DB_PATH),
    ...WEATHER_SCENARIOS.flatMap(({ name, appPort, stubPort }) => [
      stubServer(stubPort, name),
      appServer(appPort, stubPort, `test-results/e2e/${name}/rally.db`),
    ]),
  ],
})
