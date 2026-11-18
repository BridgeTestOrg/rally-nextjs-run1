import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    // Playwright specs live in e2e/ and run via `npm run test:e2e`, not Vitest.
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
})
