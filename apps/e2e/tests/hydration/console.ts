import type { Page } from '@playwright/test'

/** Console errors and warnings, failed subresources and uncaught errors of the page, from before its first script. */
export function listen(page: Page) {
  const messages: string[] = []
  page.on('console', (m) => {
    // the browsers log the document's own 404, which every path the build left out gets
    if (m.text().includes('status of 404')) return
    if (m.type() === 'error' || m.type() === 'warning') messages.push(`${m.type()}: ${m.text()}`)
  })
  page.on('response', (r) => {
    if (r.status() >= 400 && r.request().resourceType() !== 'document')
      messages.push(`failed: ${r.status()} ${r.url()}`)
  })
  page.on('pageerror', (e) => messages.push(`pageerror: ${e.message}`))
  return messages
}

/** The messages a record path that `404.html` answers may log: all but React's #418 of the shell (TanStack/router#8473). */
export const unexplained = (messages: string[]) => messages.filter((m) => !m.includes('#418'))
