import { expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Badge, type BadgeVariant } from '../app/_components/Badge'

// jsdom does not load the stylesheet. e2e/a11y.spec.ts checks each color group
// in a real browser; this checks which group each variant belongs to.
const GROUPS: [BadgeVariant, string][] = [
  ['playable', 'green'],
  ['open', 'green'],
  ['success', 'green'],
  ['breezy', 'amber'],
  ['duplicate', 'amber'],
  ['not_today', 'grey'],
  ['closed', 'grey'],
]

test.each(GROUPS)('%s renders its label in the %s group', (variant, group) => {
  render(<Badge variant={variant}>Label</Badge>)

  const badge = screen.getByText('Label')

  expect(badge.classList.contains('rally-badge')).toBe(true)
  expect(badge.classList.contains(`rally-badge--${group}`)).toBe(true)
})
