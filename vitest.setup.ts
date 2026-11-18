import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Vitest globals are off, so Testing Library's automatic cleanup never
// registers. Unmount everything rendered after each test so renders don't
// accumulate in the shared jsdom document.
afterEach(() => {
  cleanup()
})
