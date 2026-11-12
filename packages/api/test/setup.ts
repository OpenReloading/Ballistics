import type { Bundle } from '@open-reloading/catalog'
import type { ComputeRunner } from '@rangefoundry/use-cases'
import type { Catalogue } from '@rangefoundry/use-cases/catalog'
import { buildCatalogue, openCatalogue } from '@rangefoundry/use-cases/catalog'
import { Ajv2020 } from 'ajv/dist/2020.js'
import type { InjectOptions } from 'fastify'
import { beforeAll, expect } from 'vitest'
import { z } from 'zod'
import { buildApp } from '../src/app.ts'
import { bundle } from './fixtures.ts'

export { undescribed } from '../../use-cases/test/described.ts'

const emptyBundle: Bundle = {
  cartridges: [],
  manufacturers: [],
  powders: [],
  primers: [],
  bullets: [],
  cases: [],
  capacities: [],
  loads: [],
  chronoSessions: [],
  firings: [],
  rangeFirings: [],
  targetFaces: [],
  federations: [],
  disciplines: [],
  targetMappings: [],
  caliberClasses: [],
}

/** The catalogue of `data`, as the API opens it. */
export const testCatalogue = (data: Bundle): Catalogue => openCatalogue(buildCatalogue(data))

/** An app on the catalogue of `seed`, built before the tests of a file or describe block and closed after them (`false`: no records); `load` replaces it by one on another data set, `compute` as `buildApp` takes it, `get` and `post` take the whole URL. */
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

/** Checks a 200 body against the zod schema and its JSON Schema of the contract document; returns that JSON Schema and its validator. */
export function checkBody(schema: z.ZodType, body: unknown) {
  schema.parse(body)
  const json = z.toJSONSchema(schema, { io: 'output', unrepresentable: 'any' })
  const validate = ajv.compile(json)
  expect(validate(body), JSON.stringify(validate.errors)).toBe(true)
  return { json, validate }
}
