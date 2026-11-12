// Writes public/api (the static record files of today's export) and prerender.json (the record paths) for the public catalog.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { startBundleApi, writeStaticApi } from '@open-reloading/api/static'
import { makerRows } from '@open-reloading/catalog'
import bundle from '@open-reloading/catalog/bundle.json' with { type: 'json' }
import { newestNews } from '../../web/src/lib/news.ts'

// the record kinds with a page route today (apps/web/src/app/*/[id]), by route and the catalogue index list
const routes = [
  ['cartridges', 'cartridges'],
  ['bullets', 'bullets'],
  ['powders', 'powders'],
  ['primers', 'primers'],
  ['cases', 'cases'],
  ['targets', 'targetFaces'],
  ['federations', 'federations'],
  ['disciplines', 'disciplines'],
] as const

const maker = makerRows(bundle as never)
const excluded = new Set(Object.values(maker).flatMap((rows) => rows.map((r) => r.id)))
const api = await startBundleApi()
try {
  rmSync('public/api', { recursive: true, force: true })
  await writeStaticApi(api.data, 'public/api')
  const paths: string[] = []
  for (const [route, list] of routes)
    for (const { item } of api.data.index[list])
      if (!excluded.has(item.id)) paths.push(`/${route}/${item.id}/`)
  mkdirSync('generated', { recursive: true })
  writeFileSync('generated/prerender.json', JSON.stringify(paths))
  // S11: the home page's news, which apps/web reads with node:fs at build time
  mkdirSync('public/api/spike', { recursive: true })
  writeFileSync('public/api/spike/news.json', JSON.stringify(newestNews(5, '../web/news')))
  console.log(`records: ${paths.length}, maker rows left out: ${excluded.size}`)
} finally {
  await api.close()
}
