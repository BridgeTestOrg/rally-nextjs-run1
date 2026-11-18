import { expect, test as base } from '@playwright/test'

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost'])

/** Fails a test on any browser console error or uncaught page error. */
export const test = base.extend({
  page: async ({ page }, providePage) => {
    const errors: string[] = []

    page.on('console', (message) => {
      if (message.type() === 'error') {
        errors.push(message.text())
      }
    })
    page.on('pageerror', (error) => errors.push(error.message))

    // Rally calls no outside service from the browser. A stray request is
    // aborted, which also surfaces as a console error.
    await page.route(
      (url) => url.protocol.startsWith('http') && !LOCAL_HOSTS.has(url.hostname),
      (route) => route.abort(),
    )

    await providePage(page)

    expect(errors, 'browser console and page errors').toEqual([])
  },
})

export { expect }
