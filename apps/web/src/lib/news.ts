import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { type NewsItem, newestOf } from './news-items.ts'

export type { NewsItem }

/** Read at build time: a malformed file throws, so the build fails. */
export function newestNews(count = 5, dir = path.join(process.cwd(), 'news')): NewsItem[] {
  const files = readdirSync(dir).map((name) => [name, readFileSync(path.join(dir, name), 'utf8')])
  return newestOf(Object.fromEntries(files), count)
}
