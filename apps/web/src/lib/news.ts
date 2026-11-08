import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

/** One item of `apps/web/news/`. */
export interface NewsItem {
  /** `YYYY-MM-DD`, from the file name. */
  date: string
  slug: string
  title: string
  /** An app path or a docs URL. */
  link: string
  /** Two sentences. */
  text: string
}

const fileName = /^(\d{4}-\d{2}-\d{2})-([a-z0-9-]+)\.md$/

/** Blank lines may sit inside the front matter (Biome puts one after `---`); undefined without front matter. */
function newsContent(file: string): [title: string, link: string, text: string] | undefined {
  const lines = file.split(/\r?\n/)
  let i = 1
  const next = () => {
    while (lines[i]?.trim() === '') i++
    return lines[i++]
  }
  const [title, link, close] = [next(), next(), next()]
  const t = /^title: *(\S.*)$/.exec(title ?? '')?.[1]?.trimEnd()
  const l = /^link: *(\S+)\s*$/.exec(link ?? '')?.[1]
  return lines[0] === '---' && close === '---' && t && l
    ? [t, l, lines.slice(i).join('\n')]
    : undefined
}

/** Read at build time: a malformed file throws, so the build fails. */
export function newestNews(count = 5, dir = path.join(process.cwd(), 'news')): NewsItem[] {
  // every file is checked, not only the newest; the leading date sorts the names
  const items = readdirSync(dir)
    .sort()
    .reverse()
    .map((name) => {
      const m = fileName.exec(name)
      if (!m) throw new Error(`news/${name}: expected YYYY-MM-DD-slug.md`)
      const parts = newsContent(readFileSync(path.join(dir, name), 'utf8'))
      const text = parts?.[2].trim()
      if (!parts || !text) throw new Error(`news/${name}: expected a title, a link and a text`)
      return { date: m[1] ?? '', slug: m[2] ?? '', title: parts[0], link: parts[1], text }
    })
  return items.slice(0, count)
}
