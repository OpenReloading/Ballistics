import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { startBundleApi, writeStaticApi } from '@rangefoundry/api/static'
import { exportIds } from '../src/lib/prerender-sample.ts'

/** The page route of each record kind, its list in the catalogue's index and its kind in the sample. */
const recordRoutes = [
  ['bullets', 'bullets', 'bullet'],
  ['cartridges', 'cartridges', 'cartridge'],
  ['cases', 'cases', 'case'],
  ['disciplines', 'disciplines', 'discipline'],
  ['federations', 'federations', 'federation'],
  ['powders', 'powders', 'powder'],
  ['primers', 'primers', 'primer'],
  ['targets', 'targetFaces', 'target-face'],
] as const

type RecordIndex = Record<(typeof recordRoutes)[number][1], readonly { item: { id: string } }[]>

/** The path of every record page of a build, or of the ones today's export keeps with `PRERENDER=sample`. */
export function recordPaths(index: RecordIndex, env: Record<string, string | undefined>) {
  return recordRoutes.flatMap(([route, list, what]) =>
    exportIds(
      what,
      index[list].map(({ item }) => item.id),
      env,
    ).map((id) => `/${route}/${id}/`),
  )
}

if (import.meta.main) {
  const at = (file: string) => fileURLToPath(new URL(`../${file}`, import.meta.url))
  const api = await startBundleApi()
  try {
    rmSync(at('public/api'), { recursive: true, force: true })
    await writeStaticApi(api.data, at('public/api'))
    const paths = recordPaths(api.data.index, process.env)
    // the home page's record count per list, so it fetches no whole index
    const counts = recordRoutes.map(([route, list]) => [`/${route}`, api.data.index[list].length])
    writeFileSync(
      at('public/api/catalogue/counts.json'),
      JSON.stringify(Object.fromEntries(counts)),
    )
    mkdirSync(at('dist'), { recursive: true })
    writeFileSync(at('dist/prerender.json'), JSON.stringify(paths))
  } finally {
    await api.close()
  }
}
