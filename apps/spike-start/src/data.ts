import type { CatalogueIndex } from '@open-reloading/api/catalogue'
import { createIsomorphicFn } from '@tanstack/react-start'
import type { NewsItem } from '../../web/src/lib/news.ts'

// the prerender reads the data files from disk, the browser fetches them from this edition's api/
const readFile = createIsomorphicFn()
  .server(async (name: string): Promise<unknown> => {
    const { readFile } = await import('node:fs/promises')
    try {
      return JSON.parse(await readFile(`public/api/${name}.json`, 'utf8'))
    } catch {
      return undefined
    }
  })
  .client(async (name: string): Promise<unknown> => {
    const r = await fetch(`${import.meta.env.BASE_URL}api/${name}.json`)
    return r.ok ? r.json() : undefined
  })

export const readData = <T>(name: string) => readFile(name) as Promise<T | undefined>

export async function catalogueIndex() {
  const index = await readData<CatalogueIndex>('catalogue/index')
  if (!index) throw new Error('catalogue/index.json is missing: run node scripts/data.ts')
  return index
}

export const items = <T>(rows: readonly { item: T }[]) => rows.map((r) => r.item)

/** apps/web/news, written by scripts/data.ts: lib/news.ts reads it with node:fs at build time. */
export const news = async () => (await readData<NewsItem[]>('spike/news')) ?? []
