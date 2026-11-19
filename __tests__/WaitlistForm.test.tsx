import { beforeEach, describe, expect, test, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { WaitlistForm } from '../app/_sections/waitlist/WaitlistForm'
import { joinWaitlist } from '../app/_sections/waitlist/actions'
import { content, fill } from '../lib/content'
import type { WaitlistState } from '../lib/waitlist'

vi.mock('../app/_sections/waitlist/actions', () => ({
  joinWaitlist: vi.fn(),
}))

const { waitlist } = content
const action = vi.mocked(joinWaitlist)

function emailInput() {
  return screen.getByLabelText(waitlist.fields.email) as HTMLInputElement
}

function citySelect() {
  return screen.getByLabelText(waitlist.fields.city) as HTMLSelectElement
}

function levelRadios() {
  return screen.getAllByRole('radio') as HTMLInputElement[]
}

function theForm() {
  return emailInput().closest('form') as HTMLFormElement
}

/** Renders the form and submits it once, resolving with `state`. */
async function renderAfterSubmit(state: WaitlistState) {
  action.mockResolvedValueOnce(state)

  const view = render(<WaitlistForm />)

  await act(async () => {
    fireEvent.submit(theForm())
  })

  return view
}

beforeEach(() => {
  action.mockReset()
})

describe('initial form', () => {
  test('renders the contract fields and default selections', () => {
    render(<WaitlistForm />)

    expect(theForm().noValidate).toBe(true)
    expect(emailInput().name).toBe('email')
    expect(emailInput().type).toBe('email')
    expect(emailInput().autocomplete).toBe('email')
    expect(emailInput().placeholder).toBe(waitlist.fields.emailPlaceholder)
    expect(citySelect().name).toBe('city')
    expect(citySelect().value).toBe('highlands-ranch')
    expect(
      Array.from(citySelect().options).map((option) => option.label),
    ).toEqual(Object.values(waitlist.cities))

    const group = screen.getByRole('group', { name: waitlist.fields.level })

    expect(within(group).getAllByRole('radio')).toHaveLength(3)
    expect(levelRadios().map((radio) => radio.value)).toEqual([
      'new',
      'mid',
      'pro',
    ])
    expect(levelRadios().map((radio) => radio.checked)).toEqual([
      true,
      false,
      false,
    ])
    expect(
      screen.getByRole('button', { name: waitlist.submit }).getAttribute('type'),
    ).toBe('submit')
    expect(screen.getByText(waitlist.fine)).toBeDefined()
  })

  test('has its live regions before any submission', () => {
    const { container } = render(<WaitlistForm />)

    expect(screen.getByRole('status').textContent).toBe('')
    expect(screen.getByRole('status').getAttribute('aria-live')).toBe('polite')
    expect(
      container.firstElementChild?.firstElementChild?.getAttribute('aria-live'),
    ).toBe('polite')
  })
})

describe('error state', () => {
  test('keeps the values and links each error to its field', async () => {
    await renderAfterSubmit({
      status: 'error',
      fieldErrors: { email: waitlist.errors.email },
      values: { email: 'sam@', city: 'hoboken', level: 'pro' },
    })

    const message = screen.getByText(waitlist.errors.email)

    expect(emailInput().value).toBe('sam@')
    expect(emailInput().getAttribute('aria-invalid')).toBe('true')
    expect(emailInput().getAttribute('aria-describedby')).toBe(message.id)
    expect(message.parentElement?.getAttribute('aria-live')).toBe('polite')
    expect(citySelect().value).toBe('hoboken')
    expect(citySelect().getAttribute('aria-invalid')).toBeNull()
    expect(levelRadios().map((radio) => radio.checked)).toEqual([
      false,
      false,
      true,
    ])
  })

  test('selects nothing for an unknown city or level', async () => {
    await renderAfterSubmit({
      status: 'error',
      fieldErrors: {
        city: waitlist.errors.city,
        level: waitlist.errors.level,
      },
      values: { email: 'sam@example.com', city: 'denver', level: 'expert' },
    })

    const levelError = screen.getByText(waitlist.errors.level)
    const group = screen.getByRole('group', { name: waitlist.fields.level })

    expect(citySelect().value).toBe('')
    expect(citySelect().getAttribute('aria-describedby')).toBe(
      screen.getByText(waitlist.errors.city).id,
    )
    expect(
      Array.from(citySelect().options).some(
        (option) => option.value === 'denver',
      ),
    ).toBe(false)
    expect(levelRadios().some((radio) => radio.checked)).toBe(false)
    expect(group.getAttribute('aria-describedby')).toBe(levelError.id)
  })

  test('shows a server error above the button and allows a retry', async () => {
    await renderAfterSubmit({
      status: 'error',
      fieldErrors: {},
      values: { email: 'sam@example.com', city: 'hoboken', level: 'new' },
      serverError: waitlist.errors.server,
    })

    const message = screen.getByText(waitlist.errors.server)
    const button = screen.getByRole('button', {
      name: waitlist.submit,
    }) as HTMLButtonElement

    expect(message.parentElement?.getAttribute('aria-live')).toBe('polite')
    expect(
      message.compareDocumentPosition(button) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(button.disabled).toBe(false)

    action.mockResolvedValueOnce({ status: 'idle' })
    await act(async () => {
      fireEvent.submit(theForm())
    })

    expect(action).toHaveBeenCalledTimes(2)
  })

  test('returns focus to the field used to submit', async () => {
    action.mockResolvedValueOnce({
      status: 'error',
      fieldErrors: { email: waitlist.errors.email },
      values: { email: 'sam@', city: 'hoboken', level: 'new' },
    })
    render(<WaitlistForm />)
    emailInput().focus()

    await act(async () => {
      fireEvent.submit(theForm())
    })

    expect(document.activeElement).toBe(emailInput())
  })
})

describe('while pending', () => {
  test('announces progress and ignores a second submission', async () => {
    let finish: (state: WaitlistState) => void = () => {}

    action.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    render(<WaitlistForm />)

    await act(async () => {
      fireEvent.submit(theForm())
    })

    const button = screen.getByRole('button', {
      name: waitlist.submitting,
    }) as HTMLButtonElement

    expect(button.disabled).toBe(true)
    expect(screen.getByRole('status').textContent).toBe(waitlist.submitting)

    await act(async () => {
      fireEvent.submit(theForm())
    })

    expect(action).toHaveBeenCalledOnce()

    await act(async () => {
      finish({
        status: 'joined',
        email: 'sam@example.com',
        cityLabel: waitlist.cities.hoboken,
        place: 1,
      })
    })

    expect(screen.queryByRole('status')).toBeNull()
    expect(
      screen.getByRole('heading', {
        name: fill(waitlist.success.title, {
          place: 1,
          city: waitlist.cities.hoboken,
        }),
      }),
    ).toBeDefined()
  })
})

describe('result panels', () => {
  const email = '<b>sam</b>@example.com'

  test('success replaces the form and links to the courts', async () => {
    const { container } = await renderAfterSubmit({
      status: 'joined',
      email,
      cityLabel: waitlist.cities['highlands-ranch'],
      place: 41,
    })

    expect(container.querySelector('form')).toBeNull()
    expect(screen.getByText(waitlist.success.badge)).toBeDefined()
    expect(
      screen.getByRole('heading', {
        level: 3,
        name: fill(waitlist.success.title, {
          place: 41,
          city: waitlist.cities['highlands-ranch'],
        }),
      }).parentElement?.parentElement?.getAttribute('aria-live'),
    ).toBe('polite')
    expect(screen.getByText(fill(waitlist.success.body, { email }))).toBeDefined()
    expect(container.querySelector('b')).toBeNull()
    expect(
      screen
        .getByRole('link', { name: waitlist.success.cta })
        .getAttribute('href'),
    ).toBe('#courts')
  })

  test('duplicate shows the original city and date without a link', async () => {
    const { container } = await renderAfterSubmit({
      status: 'duplicate',
      email,
      cityLabel: waitlist.cities.hoboken,
      date: '2 Nov',
    })

    expect(container.querySelector('form')).toBeNull()
    expect(screen.getByText(waitlist.duplicate.badge)).toBeDefined()
    expect(
      screen.getByRole('heading', { level: 3, name: waitlist.duplicate.title }),
    ).toBeDefined()
    expect(
      screen.getByText(
        fill(waitlist.duplicate.body, {
          email,
          city: waitlist.cities.hoboken,
          date: '2 Nov',
        }),
      ),
    ).toBeDefined()
    expect(container.querySelector('b')).toBeNull()
    expect(screen.queryByRole('link')).toBeNull()
  })
})
