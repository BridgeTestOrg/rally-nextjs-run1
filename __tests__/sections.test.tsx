import { describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { CourtArt } from '../app/_components/CourtArt'
import { Faq } from '../app/_components/Faq'
import { Footer } from '../app/_components/Footer'
import { Header } from '../app/_components/Header'
import { Hero } from '../app/_components/Hero'
import { HowItWorks } from '../app/_components/HowItWorks'
import { SectionHeading } from '../app/_components/SectionHeading'
import { FinderSection } from '../app/_sections/finder/Section'
import { LiveSection } from '../app/_sections/live/Section'
import { WaitlistSection } from '../app/_sections/waitlist/Section'
import Page from '../app/page'
import { content } from '../lib/content'

function unreadSearchParams() {
  const then = vi.fn()
  const searchParams = { then } as unknown as Promise<
    Record<string, string | string[] | undefined>
  >

  return { searchParams, then }
}

test('SectionHeading ties its id to the h2', () => {
  render(<SectionHeading id="some-id" eyebrow="Eyebrow" heading="Heading" />)

  expect(screen.getByText('Eyebrow')).toBeDefined()
  expect(screen.getByRole('heading', { level: 2, name: 'Heading' }).id).toBe(
    'some-id',
  )
})

describe('Header', () => {
  test('renders the wordmark, nav links and CTA', () => {
    const { container } = render(<Header />)
    const nav = screen.getByRole('navigation', {
      name: content.header.navLabel,
    })

    expect(screen.getByText(content.site.name)).toBeDefined()
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('')

    for (const item of content.header.nav) {
      expect(
        within(nav).getByRole('link', { name: item.label }).getAttribute('href'),
      ).toBe(item.href)
    }

    expect(
      within(nav)
        .getByRole('link', { name: content.header.cta })
        .getAttribute('href'),
    ).toBe('#waitlist')
  })
})

describe('Hero', () => {
  test('renders its copy and links', () => {
    render(<Hero />)

    const heading = screen.getByRole('heading', { level: 1 })

    expect(heading.textContent).toBe(
      `${content.hero.headline} ${content.hero.headlineAccent}`,
    )
    expect(screen.getByText(content.hero.eyebrow)).toBeDefined()
    expect(screen.getByText(content.hero.lead)).toBeDefined()
    expect(
      screen
        .getByRole('link', { name: content.hero.primaryCta })
        .getAttribute('href'),
    ).toBe('#waitlist')
    expect(
      screen
        .getByRole('link', { name: content.hero.secondaryCta })
        .getAttribute('href'),
    ).toBe('#live')
  })

  test('labels the drawing', () => {
    render(<Hero />)

    expect(
      screen.getByRole('img', { name: content.hero.courtArtLabel }),
    ).toBeDefined()
  })
})

test('CourtArt keeps its children outside the labelled image', () => {
  render(
    <CourtArt label="A court">
      <p>Card text</p>
    </CourtArt>,
  )

  const image = screen.getByRole('img', { name: 'A court' })

  expect(within(image).queryByText('Card text')).toBeNull()
  expect(screen.getByText('Card text')).toBeDefined()
})

test('HowItWorks numbers each step', () => {
  render(<HowItWorks />)

  const section = screen.getByRole('region', { name: content.how.heading })
  const items = within(section).getAllByRole('listitem')

  expect(section.id).toBe('how')
  expect(items).toHaveLength(content.how.steps.length)

  content.how.steps.forEach((step, index) => {
    const item = within(items[index])

    expect(item.getByText(String(index + 1))).toBeDefined()
    expect(
      item.getByRole('heading', { level: 3, name: step.title }),
    ).toBeDefined()
    expect(item.getByText(step.body)).toBeDefined()
  })
})

describe('Faq', () => {
  test('renders closed native disclosures', () => {
    const { container } = render(<Faq />)
    const items = container.querySelectorAll('details')

    expect(screen.getByRole('region', { name: content.faq.heading }).id).toBe(
      'faq',
    )
    expect(items).toHaveLength(content.faq.items.length)

    content.faq.items.forEach((item, index) => {
      expect(items[index].open).toBe(false)
      expect(items[index].querySelector('summary')?.textContent).toBe(item.q)
      expect(within(items[index]).getByText(item.a)).toBeDefined()
    })
  })

  test('opens from its summary', () => {
    const { container } = render(<Faq />)
    const item = container.querySelector('details') as HTMLDetailsElement

    fireEvent.click(item.querySelector('summary') as HTMLElement)

    expect(item.open).toBe(true)
  })
})

test('Footer renders the legal line and links', () => {
  render(<Footer />)

  expect(screen.getByText(content.footer.legal)).toBeDefined()
  expect(
    screen.getByRole('link', { name: content.footer.faq }).getAttribute('href'),
  ).toBe('#faq')
  expect(
    screen
      .getByRole('link', { name: content.footer.email })
      .getAttribute('href'),
  ).toBe(`mailto:${content.footer.email}`)
})

describe('section shells', () => {
  const { searchParams } = unreadSearchParams()

  test.each([
    ['live', content.live, <LiveSection key="live" />],
    [
      'courts',
      content.finder,
      <FinderSection key="courts" searchParams={searchParams} />,
    ],
  ])('%s renders only its eyebrow and heading', (id, copy, element) => {
    render(element)

    const section = screen.getByRole('region', { name: copy.heading })

    expect(section.id).toBe(id)
    expect(within(section).getByText(copy.eyebrow)).toBeDefined()
    expect(section.textContent).toBe(`${copy.eyebrow}${copy.heading}`)
    expect(section.querySelector('form, a, button, input')).toBeNull()
  })
})

test('waitlist keeps its anchor and heading around the form', () => {
  render(<WaitlistSection />)

  const section = screen.getByRole('region', {
    name: content.waitlist.heading,
  })

  expect(section.id).toBe('waitlist')
  expect(within(section).getByText(content.waitlist.eyebrow)).toBeDefined()
  expect(section.querySelector('form')).not.toBeNull()
})

describe('Page', () => {
  test('renders every section in order without reading searchParams', () => {
    const { searchParams, then } = unreadSearchParams()
    const { container } = render(<Page searchParams={searchParams} />)

    expect(then).not.toHaveBeenCalled()
    expect(
      Array.from(container.querySelectorAll('main > section[id]')).map(
        (section) => section.id,
      ),
    ).toEqual(['live', 'courts', 'how', 'waitlist', 'faq'])
    expect(container.querySelector('main header, main footer')).toBeNull()
    expect(screen.getByRole('banner')).toBeDefined()
    expect(screen.getByRole('contentinfo')).toBeDefined()
  })

  test('every in-page link has a target', () => {
    const { searchParams } = unreadSearchParams()
    const { container } = render(<Page searchParams={searchParams} />)
    const links = container.querySelectorAll('a[href^="#"]')

    expect(links.length).toBeGreaterThan(0)
    links.forEach((link) => {
      expect(container.querySelector(link.getAttribute('href') as string)).not.toBeNull()
    })
  })
})
