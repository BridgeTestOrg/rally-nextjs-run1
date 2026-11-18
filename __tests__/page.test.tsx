import { afterEach, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Hero } from '../app/_components/Hero'
import { content } from '../lib/content'

afterEach(() => {
  vi.restoreAllMocks()
})

test('hero renders its heading and the default card', () => {
  const resolvedOptions = Intl.DateTimeFormat.prototype.resolvedOptions
  vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockImplementation(
    function (this: Intl.DateTimeFormat) {
      return { ...resolvedOptions.call(this), timeZone: 'Europe/London' }
    },
  )

  render(<Hero />)

  expect(screen.getByRole('heading', { level: 1 })).toBeDefined()
  expect(screen.getByText(content.hero.card.default.badge)).toBeDefined()
  expect(screen.getByText(content.hero.card.default.name)).toBeDefined()
  expect(screen.getByText(content.hero.card.default.line)).toBeDefined()
})
