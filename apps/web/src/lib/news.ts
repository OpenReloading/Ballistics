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
const content = /^---\r?\ntitle: *(\S.*?)\s*\r?\nlink: *(\S+)\s*\r?\n---\r?\n([\s\S]*)$/

/**
 * The newest `count` items of the news folder, newest first. Read by the server page at build
 * time: a malformed file name or a file without title, link or text throws, so the build fails.
 */
export function newestNews(count = 5, dir = path.join(process.cwd(), 'news')): NewsItem[] {
  // every file is checked, not only the newest; the leading date sorts the names
  const items = readdirSync(dir)
    .sort()
    .reverse()
    .map((name) => {
      const m = fileName.exec(name)
      if (!m) throw new Error(`news/${name}: expected YYYY-MM-DD-slug.md`)
      const parts = content.exec(readFileSync(path.join(dir, name), 'utf8'))
      const text = parts?.[3]?.trim()
      if (!parts || !text) throw new Error(`news/${name}: expected a title, a link and a text`)
      return {
        date: m[1] ?? '',
        slug: m[2] ?? '',
        title: parts[1] ?? '',
        link: parts[2] ?? '',
        text,
      }
    })
  return items.slice(0, count)
}
