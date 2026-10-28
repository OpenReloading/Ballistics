import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { MantineProvider } from '@mantine/core'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HomeNews } from '../src/components/home-news.tsx'
import de from '../src/i18n/de.json'
import { type Translator, translator } from '../src/i18n/translate.ts'
import { newestNews } from '../src/lib/news.ts'

const shown = vi.hoisted(() => ({ t: undefined as Translator | undefined }))

// the panel reads the language through the hook, which a server render has not
vi.mock('../src/i18n/language.ts', () => ({ useTranslation: () => shown.t }))

const item = (title: string) => `---\ntitle: ${title}\nlink: /workbench\n---\nOne. Two.\n`

let dirs: string[] = []
const folder = (files: Record<string, string>) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'news-'))
  dirs.push(dir)
  for (const [name, text] of Object.entries(files)) writeFileSync(path.join(dir, name), text)
  return dir
}
afterEach(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true })
  dirs = []
})

describe('news', () => {
  it('lists the newest five, newest first', () => {
    const files = Object.fromEntries(
      [3, 1, 6, 2, 5, 4].map((d) => [`2026-10-0${d}-item-${d}.md`, item(`Item ${d}`)]),
    )
    const items = newestNews(5, folder(files))
    expect(items.map((n) => n.title)).toEqual(['Item 6', 'Item 5', 'Item 4', 'Item 3', 'Item 2'])
    expect(items[0]).toEqual({
      date: '2026-10-06',
      slug: 'item-6',
      title: 'Item 6',
      link: '/workbench',
      text: 'One. Two.',
    })
  })

  it('throws on a file name without the date and slug', () => {
    const dir = folder({ '2026-10-01-a.md': item('A'), 'news.md': item('B') })
    expect(() => newestNews(5, dir)).toThrow('news/news.md: expected YYYY-MM-DD-slug.md')
  })

  it.each([
    ['title', '---\nlink: /\n---\nOne. Two.\n'],
    ['link', '---\ntitle: A\n---\nOne. Two.\n'],
    ['text', '---\ntitle: A\nlink: /\n---\n\n'],
  ])('throws on a file without a %s', (_, text) => {
    const dir = folder({ '2026-10-01-a.md': text })
    expect(() => newestNews(5, dir)).toThrow('news/2026-10-01-a.md: expected a title')
  })

  it('reads the items of the app', () => {
    const items = newestNews(5, path.join(import.meta.dirname, '../news'))
    expect(items.length).toBeGreaterThan(0)
  })

  it('renders the items in their order under the translated heading', () => {
    const items = newestNews(
      5,
      folder({ '2026-10-01-a.md': item('A'), '2026-10-02-b.md': item('B') }),
    )
    const render = (language: Translator) => {
      shown.t = language
      return renderToStaticMarkup(
        <MantineProvider>
          <HomeNews items={items} />
        </MantineProvider>,
      )
    }
    const english = render(translator())
    expect(english).toContain('>What&#x27;s new</h2>')
    expect(english.indexOf('>B</a>')).toBeLessThan(english.indexOf('>A</a>'))
    expect(render(translator(de, 'de'))).toContain('>Neuigkeiten</h2>')
  })
})
