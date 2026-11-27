import { I18nProvider } from '@lingui/react'
import { MantineProvider } from '@mantine/core'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { RepositoryLink } from '../src/components/repository-link.tsx'
import { linguiOf } from '../src/i18n/lingui.ts'
import { repositoryUrl, sourceUrl } from '../src/lib/repository-url.ts'

/** The link's markup in English; a message without its English fails the test. */
function render(url?: string | undefined, drawer?: boolean) {
  const missing: string[] = []
  const stop = linguiOf('en').on('missing', ({ id }) => missing.push(id))
  const html = renderToStaticMarkup(
    <I18nProvider i18n={linguiOf('en')}>
      <MantineProvider>
        <RepositoryLink url={url} drawer={drawer} />
      </MantineProvider>
    </I18nProvider>,
  )
  stop()
  expect(missing).toEqual([])
  return html
}

it('renders nothing without a URL', () => {
  for (const html of [render(), render(undefined, true), render(repositoryUrl(''))]) {
    expect(html).not.toContain('<a')
    expect(html).not.toContain('Source code')
  }
})

it('the top bar link is an icon with the accessible name, opening in the same tab', () => {
  const html = render('https://example.org/repo')
  expect(html).toContain('href="https://example.org/repo"')
  expect(html).toContain('aria-label="Source code on GitHub"')
  expect(html).not.toContain('target=')
  expect(html).toContain('<svg')
})

it('the drawer link shows the text that is its accessible name', () => {
  const html = render('https://example.org/repo', true)
  expect(html).toContain('href="https://example.org/repo"')
  expect(html).toContain('>Source code on GitHub<')
  expect(html).not.toContain('target=')
})

it('repositoryUrl drops an unset or empty value', () => {
  expect(repositoryUrl(undefined)).toBeUndefined()
  expect(repositoryUrl('')).toBeUndefined()
  expect(repositoryUrl('  ')).toBeUndefined()
  expect(repositoryUrl('https://github.com/OpenReloading/openreloading')).toBe(
    'https://github.com/OpenReloading/openreloading',
  )
})

it('sourceUrl names the commit of the build, else its release tag, in the given repository or this one', () => {
  const sha = 'abcdef0123456789abcdef0123456789abcdef01'
  expect(sourceUrl('https://example.org/fork', sha, '0.0.7')).toBe(
    `https://example.org/fork/tree/${sha}`,
  )
  expect(sourceUrl(undefined, sha, '0.0.7')).toBe(
    `https://github.com/OpenReloading/Ballistics/tree/${sha}`,
  )
  expect(sourceUrl(' ', '', '0.0.7')).toBe(
    'https://github.com/OpenReloading/Ballistics/tree/web-v0.0.7',
  )
})
