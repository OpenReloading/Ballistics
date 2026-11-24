import { type Catalogue, type CatalogueIndex, openCatalogue } from '@rangefoundry/use-cases/catalog'
import { createIsomorphicFn } from '@tanstack/react-start'

/** A data file of this build by its path below `api/` without `.json`, undefined when there is none: the prerender reads it from disk, the browser fetches it from its edition's `api/`. */
export const readData = createIsomorphicFn()
  .server(async (file: string): Promise<unknown> => {
    // oxlint-disable-next-line no-restricted-imports -- only the prerender runs this branch, Start drops it from the client
    const { readFile } = await import('node:fs/promises')
    try {
      return JSON.parse(await readFile(`public/api/${file}.json`, 'utf8'))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
      throw error
    }
  })
  .client(async (file: string): Promise<unknown> => {
    const response = await fetch(`${import.meta.env.BASE_URL}api/${file}.json`)
    if (response.status === 404) return undefined
    if (!response.ok) throw new Error(`Error ${response.status}.`)
    return response.json()
  })

let opened: Promise<Catalogue> | undefined

/** The catalogue's lists of this build, opened once; a record comes from its own file through `readData`. */
export function readCatalogue(): Promise<Catalogue> {
  opened ??= readData('catalogue/index').then((index) => {
    if (!index) throw new Error('api/catalogue/index.json is missing')
    return openCatalogue({
      index: index as CatalogueIndex,
      records: () => {
        throw new Error('the catalogue is opened for its lists only')
      },
    })
  })
  // a failed read (offline, say) is tried again on the next visit
  opened.catch(() => {
    opened = undefined
  })
  return opened
}

/** The record file of each of `items` in `kind`; a missing one throws, as the Next page fails its build. */
export const readRecords = <T>(kind: string, items: readonly { id: string }[]) =>
  Promise.all(
    items.map(async ({ id }) => {
      const record = await readData(`${kind}/${id}`)
      if (record === undefined) throw new Error(`api/${kind}/${id}.json is missing`)
      return record as T
    }),
  )
