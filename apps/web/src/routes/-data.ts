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
