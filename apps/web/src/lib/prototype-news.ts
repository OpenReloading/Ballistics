import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

/** One news item as the build step hands it to the server component. */
export interface NewsItem {
  /** `YYYY-MM-DD`, from the file name. */
  date: string
  slug: string
  title: string
  /** Two sentences. */
  text: string
  /** An app path or a docs URL. */
  href: string
}

const file = /^(\d{4}-\d{2}-\d{2})-([a-z0-9-]+)\.md$/

/** The newest `count` items of `apps/web/news/`, newest first; a malformed file throws, so the build fails. */
export function newestNews(count = 5, dir = path.join(process.cwd(), 'news')): NewsItem[] {
  return readdirSync(dir)
    .sort()
    .reverse()
    .slice(0, count)
    .map((name) => {
      const m = file.exec(name)
      if (!m) throw new Error(`news/${name}: expected YYYY-MM-DD-slug.md`)
      const parts = /^---\ntitle: (.+)\nlink: (.+)\n---\n([\s\S]+)$/.exec(
        readFileSync(path.join(dir, name), 'utf8'),
      )
      if (!parts) throw new Error(`news/${name}: expected title, link and a text`)
      return {
        date: m[1] ?? '',
        slug: m[2] ?? '',
        title: parts[1] ?? '',
        href: parts[2] ?? '',
        text: (parts[3] ?? '').trim(),
      }
    })
}
