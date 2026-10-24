import type { Bundle } from '@open-reloading/data'
import { Ajv2020 } from 'ajv/dist/2020.js'
import type { InjectOptions } from 'fastify'
import { beforeAll, expect } from 'vitest'
import { z } from 'zod'
import { buildApp } from '../src/app.ts'
import { buildCatalogue } from '../src/catalogue/build.ts'
import { openCatalogue } from '../src/catalogue/open.ts'
import type { Catalogue } from '../src/catalogue/types.ts'
import type { ComputeRunner } from '../src/compute/tasks.ts'
import { bundle } from './fixtures.ts'

/** A data set without records. */
export const emptyBundle: Bundle = {
  cartridges: [],
  manufacturers: [],
  powders: [],
  bullets: [],
  capacities: [],
  loads: [],
  chronoSessions: [],
  firings: [],
  rangeFirings: [],
  targetFaces: [],
  federations: [],
  disciplines: [],
  targetMappings: [],
}

/** The catalogue of `data`, as the API opens it. */
export const testCatalogue = (data: Bundle): Catalogue => openCatalogue(buildCatalogue(data))

/**
 * An app on the catalogue of `seed` for the tests of a file or a describe block: built before
 * them, closed after them (`false`: no records). `load` replaces the app by one on another data
 * set, `compute` as `buildApp` takes it. `get` and `post` take the whole URL.
 */
export function withApi({
  seed = bundle,
  compute,
}: {
  seed?: Bundle | false
  compute?: ComputeRunner
} = {}) {
  const send = async (options: InjectOptions) => {
    const res = await api.app.inject(options)
    return { status: res.statusCode, body: res.json() }
  }
  const open = (data: Bundle) => {
    api.catalogue = testCatalogue(data)
    api.app = buildApp({ catalogue: api.catalogue, compute })
  }
  const api = {
    catalogue: undefined as unknown as Catalogue,
    app: undefined as unknown as ReturnType<typeof buildApp>,
    get: (url: string) => send({ url }),
    post: (url: string, payload: unknown) =>
      send({ method: 'POST', url, payload: payload as object }),
    load: async (data: Bundle) => {
      await api.app.close()
      open(data)
    },
  }
  beforeAll(() => {
    open(seed || emptyBundle)
    return () => api.app.close()
  })
  return api
}

const ajv = new Ajv2020({ allErrors: true, strict: false, validateFormats: false })

/**
 * Checks a 200 body against the zod schema and against its JSON Schema of the contract document;
 * returns that JSON Schema and its validator.
 */
export function checkBody(schema: z.ZodType, body: unknown) {
  schema.parse(body)
  const json = z.toJSONSchema(schema, { io: 'output', unrepresentable: 'any' })
  const validate = ajv.compile(json)
  expect(validate(body), JSON.stringify(validate.errors)).toBe(true)
  return { json, validate }
}

type Schema = Record<string, unknown>

/**
 * Paths of the JSON Schema properties without a non-empty description, at any depth of `schema`:
 * under `properties`, `items`, `additionalProperties`, `anyOf`, `oneOf`, `allOf` and `prefixItems`.
 */
export function undescribed(schema: unknown, path = ''): string[] {
  if (!schema || typeof schema !== 'object') return []
  const s = schema as Schema
  const own = Object.entries((s.properties ?? {}) as Record<string, Schema>).flatMap(
    ([key, value]) => {
      const at = `${path}.${key}`
      const missing =
        typeof value.description === 'string' && value.description.trim() !== '' ? [] : [at]
      return [...missing, ...undescribed(value, at)]
    },
  )
  const nested = ['items', 'additionalProperties'].flatMap((k) => undescribed(s[k], `${path}[]`))
  const lists = ['anyOf', 'oneOf', 'allOf', 'prefixItems'].flatMap((k) =>
    ((s[k] ?? []) as unknown[]).flatMap((x, i) => undescribed(x, `${path}<${k}${i}>`)),
  )
  return [...own, ...nested, ...lists]
}
