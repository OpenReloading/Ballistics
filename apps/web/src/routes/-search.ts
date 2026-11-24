import { z } from 'zod'

// the router reads `?bullet=308` as a number; the views read the address themselves, so a value keeps its form
const param = z.union([z.string(), z.number()]).optional().catch(undefined)

/** The query parameters a page's views read from the address, each optional; any other key stays in it. */
export const searchOf = <K extends string>(...keys: K[]) =>
  z.looseObject(Object.fromEntries(keys.map((key) => [key, param])) as Record<K, typeof param>)
