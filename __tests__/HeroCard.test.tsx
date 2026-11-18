import { afterEach, describe, expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { HeroCard } from '../app/_components/HeroCard'
import { content } from '../lib/content'

const { card } = content.hero

function useBrowserZone(timeZone: string) {
  const resolvedOptions = Intl.DateTimeFormat.prototype.resolvedOptions

  vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions').mockImplementation(
    function (this: Intl.DateTimeFormat) {
      return { ...resolvedOptions.call(this), timeZone }
    },
  )
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('in the browser', () => {
  test.each(Object.entries(card.byTimeZone))(
    '%s shows its city',
    (timeZone, city) => {
      useBrowserZone(timeZone)
      render(<HeroCard card={card} />)

      expect(screen.getByText(card.nearYouBadge)).toBeDefined()
      expect(screen.getByText(city.name)).toBeDefined()
      expect(screen.getByText(city.line)).toBeDefined()
      expect(screen.queryByText(card.default.name)).toBeNull()
    },
  )

  test.each(['Europe/London', 'toString', '__proto__'])(
    '%s keeps the default card',
    (timeZone) => {
      useBrowserZone(timeZone)
      render(<HeroCard card={card} />)

      expect(screen.getByText(card.default.badge)).toBeDefined()
      expect(screen.getByText(card.default.name)).toBeDefined()
      expect(screen.getByText(card.default.line)).toBeDefined()
      expect(screen.queryByText(card.nearYouBadge)).toBeNull()
    },
  )
})

test('the server always renders the default card', () => {
  useBrowserZone('America/Denver')

  const html = renderToString(<HeroCard card={card} />)

  expect(html).toContain(card.default.name)
  expect(html).not.toContain(card.nearYouBadge)
})
