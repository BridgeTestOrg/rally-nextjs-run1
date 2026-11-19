import { describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { Button, type ButtonVariant } from '../app/_components/Button'

const VARIANTS: ButtonVariant[] = ['ball', 'ghost', 'court']

describe.each(VARIANTS)('%s variant', (variant) => {
  test('renders a link when given href', () => {
    render(
      <Button variant={variant} href="#target">
        Go
      </Button>,
    )

    const link = screen.getByRole('link', { name: 'Go' })

    expect(link.getAttribute('href')).toBe('#target')
    expect(link.classList.contains(`rally-button--${variant}`)).toBe(true)
  })

  test('renders a button without href', () => {
    render(<Button variant={variant}>Go</Button>)

    const button = screen.getByRole('button', { name: 'Go' })

    expect(button.classList.contains(`rally-button--${variant}`)).toBe(true)
  })
})

describe('native button', () => {
  test('defaults to type button', () => {
    render(<Button variant="ball">Go</Button>)

    expect(screen.getByRole('button').getAttribute('type')).toBe('button')
  })

  test('allows the type to be overridden', () => {
    render(
      <Button variant="ball" type="submit">
        Go
      </Button>,
    )

    expect(screen.getByRole('button').getAttribute('type')).toBe('submit')
  })

  test('calls its click handler when idle', () => {
    const onClick = vi.fn()
    render(
      <Button variant="ball" onClick={onClick}>
        Go
      </Button>,
    )

    fireEvent.click(screen.getByRole('button'))

    expect(onClick).toHaveBeenCalledOnce()
  })

  test('honors disabled without showing a busy state', () => {
    render(
      <Button variant="ball" disabled>
        Go
      </Button>,
    )

    const button = screen.getByRole('button') as HTMLButtonElement

    expect(button.disabled).toBe(true)
    expect(button.getAttribute('aria-busy')).toBeNull()
  })

  test('is disabled, busy and keeps its label while loading', () => {
    const onClick = vi.fn()
    const { container } = render(
      <Button variant="court" loading onClick={onClick}>
        Saving
      </Button>,
    )

    const button = screen.getByRole('button', {
      name: 'Saving',
    }) as HTMLButtonElement

    fireEvent.click(button)

    expect(button.disabled).toBe(true)
    expect(button.getAttribute('aria-busy')).toBe('true')
    expect(onClick).not.toHaveBeenCalled()
    expect(
      container
        .querySelector('.rally-button__spinner')
        ?.getAttribute('aria-hidden'),
    ).toBe('true')
  })
})

describe('link', () => {
  test('stays clickable when idle', () => {
    const onClick = vi.fn()
    render(
      <Button variant="ball" href="#target" onClick={onClick}>
        Go
      </Button>,
    )

    const link = screen.getByRole('link')

    expect(link.getAttribute('aria-disabled')).toBeNull()
    expect(link.getAttribute('aria-busy')).toBeNull()
    expect(fireEvent.click(link)).toBe(true)
    expect(onClick).toHaveBeenCalledOnce()
  })

  test('is marked disabled and busy while loading', () => {
    render(
      <Button variant="ball" href="#target" loading>
        Go
      </Button>,
    )

    const link = screen.getByRole('link', { name: 'Go' })

    expect(link.getAttribute('aria-disabled')).toBe('true')
    expect(link.getAttribute('aria-busy')).toBe('true')
  })

  test.each([
    ['a primary click', 'click', {}],
    ['a modified click', 'click', { ctrlKey: true }],
    ['an auxiliary click', 'auxclick', { button: 1 }],
  ])('blocks %s while loading', (_name, type, init) => {
    const handler = vi.fn()
    render(
      <Button
        variant="ball"
        href="#target"
        loading
        onClick={handler}
        onAuxClick={handler}
      >
        Go
      </Button>,
    )

    const link = screen.getByRole('link')
    const event = new MouseEvent(type, {
      ...init,
      bubbles: true,
      cancelable: true,
    })

    fireEvent(link, event)

    expect(event.defaultPrevented).toBe(true)
    expect(handler).not.toHaveBeenCalled()
  })
})
