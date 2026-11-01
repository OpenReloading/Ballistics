import { STATUS_CODES } from 'node:http'
import type { RouteOptions } from 'fastify'
import type { z } from 'zod'
import { buildApp } from './app.ts'
import type { Catalogue } from './catalogue/types.ts'
import { type JsonSchema, jsonSchema } from './compute/json-schema.ts'
import { inlineRunner } from './compute/tasks.ts'
import { API_VERSION } from './version.ts'

declare module 'fastify' {
  interface FastifyContextConfig {
    /** zod schema of the JSON body, read by `buildOpenApi`. */
    body?: z.ZodType
    /** zod schema of the query string, read by `buildOpenApi`. */
    query?: z.ZodType
    /** zod schema of the 200 body, read by `buildOpenApi`; absent: any JSON object. */
    response?: z.ZodType
    /**
     * Error statuses of the route's own code (404, 422, 503), read by `buildOpenApi`, which adds
     * the statuses of Fastify (400, 413, 414, 415) and 500.
     */
    errors?: number[]
    /** The route answers an unknown id that `renames.json` replaces with 308 and a `Location`. */
    moved?: boolean
    /** One line on what the route answers, read by `buildOpenApi`. */
    summary?: string
    /** What the route reads or computes and how, read by `buildOpenApi`. */
    description?: string
    /** A valid request body, read by `buildOpenApi`. */
    example?: unknown
  }
}

/** The parts of an OpenAPI 3.1 document that the breaking-change check and the reference read. */
export interface OpenApiDocument {
  openapi: '3.1.0'
  info: { title: string; version: string; description: string }
  tags: { name: string; description: string }[]
  paths: Record<string, Record<string, OpenApiOperation>>
  components: { schemas: Record<string, JsonSchema> }
}

/** One operation: parameters, a JSON request body and the JSON responses by status. */
interface OpenApiOperation {
  /** `<method><path words>`, for example `getBulletsById`; unique per operation. */
  operationId?: string | undefined
  /** The group of the route in the reference: one of `tags`. */
  tags?: string[] | undefined
  /** One line on what the route answers. */
  summary?: string | undefined
  /** What the route reads or computes. */
  description?: string | undefined
  parameters?: {
    name: string
    in: 'query' | 'path'
    required: boolean
    description?: string
    schema: JsonSchema
  }[]
  requestBody?: {
    required: true
    content: { 'application/json': { schema: JsonSchema; example?: unknown } }
  }
  responses: Record<
    string,
    {
      description: string
      headers?: Record<string, { schema: JsonSchema }>
      content?: { 'application/json': { schema: JsonSchema } }
    }
  >
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** The path segments without the version: `/v1/bullets/{id}` gives `bullets` and `{id}`. */
const segments = (url: string) => url.split('/').filter((s) => s && !/^v\d+$/.test(s))

/** `get` and `/v1/bullets/{id}` give `getBulletsById`. */
const operationId = (method: string, url: string) =>
  method +
  segments(url)
    .map((s) =>
      s.startsWith('{') ? `By${capital(s.slice(1, -1))}` : s.split('-').map(capital).join(''),
    )
    .join('')

/** The groups of the reference, by the first path segment of a route. */
const tags = [
  {
    name: 'Records',
    description:
      'Cartridges with their C.I.P. sheet values, manufacturers, powders, primers, bullets and cartridge cases.',
    segments: ['cartridges', 'manufacturers', 'powders', 'primers', 'bullets', 'cases'],
  },
  {
    name: 'Competition',
    description:
      'Federations, their disciplines, target faces, the mapping between them, the caliber classes of the disciplines and the event types with their scoring.',
    segments: [
      'federations',
      'disciplines',
      'target-faces',
      'target-mappings',
      'caliber-classes',
      'event-types',
    ],
  },
  {
    name: 'Exterior',
    description:
      'Trajectories, truing to observed drops or velocities, range strings and gyroscopic stability.',
    segments: ['exterior'],
  },
  {
    name: 'Interior',
    description:
      'Simulations of the shot inside the barrel and the charge that reaches a target. Results are simulations, not load data.',
    segments: ['interior'],
  },
]

const tagOf = (url: string) => {
  const first = segments(url)[0]
  const tag = tags.find((t) => t.segments.some((s) => s === first))
  if (!tag) throw new Error(`no tag for ${url}`)
  return tag.name
}

/**
 * The body of every error answer: Fastify's (with `code`, for example `FST_ERR_VALIDATION`), the
 * schema 400 (`issues`), the compute answers (`reason`, `missing`, `notice` and more) and the 500
 * (`requestId`, the `reqId` of the server log line of the error).
 */
const errorBody: JsonSchema = {
  type: 'object',
  properties: {
    statusCode: { type: 'integer' },
    error: { type: 'string' },
    message: { type: 'string' },
    code: { type: 'string' },
    issues: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          path: { type: 'array', items: { type: ['string', 'integer'] } },
          message: { type: 'string' },
        },
        required: ['path', 'message'],
      },
    },
    reason: { type: 'string' },
    missing: {
      type: 'array',
      description:
        'The load file route with `reason` `missingValues`: every solver value the file lacks, with its key, its path in the file and its stored quantity.',
      items: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          path: { type: 'array', items: { type: ['string', 'integer'] } },
          quantity: { type: 'string' },
        },
        required: ['key', 'path', 'quantity'],
      },
    },
    notice: { type: 'string' },
    requestId: { type: 'string' },
  },
  required: ['statusCode', 'error', 'message'],
}

/**
 * The statuses of a route: 200; 400 when Fastify or zod validates its input (an undeclared query
 * parameter included); its own `errors`;
 * 413 (`bodyLimit`) and 415 (no JSON content type) when it takes a body; 414 when it has a path
 * parameter (the router's `maxParamLength`, 100 characters); 500.
 */
function responses(
  route: RouteOptions,
  url: string,
  inputs: (JsonSchema | undefined)[],
): OpenApiOperation['responses'] {
  const config = route.config ?? {}
  const statuses = [
    ...([...inputs, config.body].some(Boolean) ? [400] : []),
    ...(config.errors ?? []),
    ...(config.moved ? [308] : []),
    ...(url.includes('{') ? [414] : []),
    ...(config.body ? [413, 415] : []),
    500,
  ].sort((a, b) => a - b)
  const json = (schema: JsonSchema) => ({ 'application/json': { schema } })
  return {
    200: {
      description: 'OK',
      content: json(config.response ? jsonSchema(config.response, 'output') : { type: 'object' }),
    },
    ...Object.fromEntries(
      statuses.map((s) => [
        s,
        s === 308
          ? {
              description:
                'Permanent Redirect: the id was renamed, `Location` is the record that replaced it.',
              headers: { Location: { schema: { type: 'string' } } },
            }
          : {
              description:
                s === 400
                  ? 'Bad Request: a query parameter or field the route does not declare, or a value its schema refuses; `message` or `issues` names it.'
                  : (STATUS_CODES[s] ?? String(s)),
              content: json({ $ref: '#/components/schemas/Error' }),
            },
      ]),
    ),
  }
}

function parameters(where: 'query' | 'path', schema: JsonSchema) {
  const required = (schema.required as string[] | undefined) ?? []
  const properties = (schema.properties ?? {}) as Record<string, JsonSchema>
  return Object.entries(properties).map(([name, { description, ...s }]) => ({
    name,
    in: where,
    required: where === 'path' || required.includes(name),
    ...(typeof description === 'string' && { description }),
    schema: s,
  }))
}

/** The operation of one method of a route, `url` in OpenAPI path form. */
function operationOf(route: RouteOptions, method: string, url: string): OpenApiOperation {
  const schema = (route.schema ?? {}) as { querystring?: JsonSchema; params?: JsonSchema }
  const query = route.config?.query ? jsonSchema(route.config.query) : schema.querystring
  const op: OpenApiOperation = {
    operationId: operationId(method.toLowerCase(), url),
    tags: [tagOf(url)],
    summary: route.config?.summary,
    description: route.config?.description,
    parameters: [...parameters('path', schema.params ?? {}), ...parameters('query', query ?? {})],
    responses: responses(route, url, [schema.params, query]),
  }
  if (route.config?.body)
    op.requestBody = {
      required: true,
      content: {
        'application/json': {
          schema: jsonSchema(route.config.body),
          ...(route.config.example !== undefined && { example: route.config.example }),
        },
      },
    }
  return op
}

/**
 * The contract document of the running routes: every route registered by `buildApp`, with the
 * query, path and body schemas the routes declare (Fastify JSON schemas, or the zod schemas in the
 * route `config`), and the responses: 200 with the `config.response` schema, else any JSON object,
 * and each error status the route answers with the shared `Error` body (`responses`).
 * `GET /` (the liveness probe) is not part of the contract. `info.version` is `API_VERSION`.
 */
export async function buildOpenApi(): Promise<OpenApiDocument> {
  const routes: RouteOptions[] = []
  const app = buildApp({
    catalogue: {} as Catalogue,
    compute: inlineRunner,
    onRoute: (r) => routes.push(r),
  })
  await app.ready()
  await app.close()
  const paths: OpenApiDocument['paths'] = {}
  for (const route of routes) {
    if (route.url === '/') continue
    const url = route.url.replace(/:(\w+)/g, '{$1}')
    for (const method of [route.method].flat()) {
      if (method === 'HEAD') continue
      const op = operationOf(route, method, url)
      paths[url] = { ...paths[url], [method.toLowerCase()]: op }
    }
  }
  const sorted = Object.fromEntries(Object.entries(paths).sort(([a], [b]) => a.localeCompare(b)))
  return {
    openapi: '3.1.0',
    info: {
      title: 'OpenReloading API',
      version: API_VERSION,
      description:
        'Records of cartridges, components and competitions, and the exterior and interior ballistics models. Quantities are SI (m, kg, s, Pa, K, rad) unless a field names another unit. Results are simulations, not load data.',
    },
    tags: tags.map(({ name, description }) => ({ name, description })),
    paths: sorted,
    components: { schemas: { Error: errorBody } },
  }
}
