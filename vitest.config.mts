import path from 'node:path'
import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  resolve: {
    alias: {
      // An absolute file path skips the package's `exports` map, whose default
      // entry throws outside a React Server Components build.
      'server-only': path.resolve('node_modules/server-only/empty.js'),
    },
  },
  test: {
    environment: 'jsdom',
    env: { TZ: 'UTC' },
    setupFiles: ['./vitest.setup.ts'],
    // Playwright specs live in e2e/ and run via `npm run test:e2e`, not Vitest.
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
})
