import { recordIdRegex } from '@open-reloading/schema'
import type { FastifyReply } from 'fastify'
import { z } from 'zod'
import type { Catalogue, Catalogued, CatalogueKind } from '../catalogue/types.ts'
import type { ComputeRunner } from '../compute/tasks.ts'
import { API_PREFIX } from '../version.ts'

/** `pattern` of a query string value without a NUL character. */
export const noNul = '^[^\\u0000]*$'

/** `pattern` of search text without a control character (a search key separates its parts with one). */
const noControl = '^[^\\u0000-\\u001f\\u007f-\\u009f]*$'

/** `pattern` of a record id, as `recordId` of `@open-reloading/schema`. */
export const recordIdPattern = recordIdRegex.source

/** What the compute routes read: the records to resolve ids against and the solver task runner. */
export type ComputeContext = { catalogue: Catalogue; compute: ComputeRunner }

/** A record as the routes answer it: the stored record without the `kind`, `origin` and `revision` that `Catalogue.get` adds. */
export function stored<K extends CatalogueKind>(record: Catalogued<K>) {
  const { kind, origin, revision, ...rest } = record
  return rest
}

/** The `revision` field of the record answers that carry one. */
export const revision = z.string().describe('Hash of the stored record, changes with any field.')

/** A record as {@link stored} gives it, with its `revision`. */
export function revised<K extends CatalogueKind>(record: Catalogued<K>) {
  return { ...stored(record), revision: record.revision }
}

/** A record with its `origin` and `revision`, without the `kind`, for a kind whose schema carries `origin`. */
export function originated<K extends CatalogueKind>(record: Catalogued<K>) {
  const { kind, ...rest } = record
  return rest
}

/** The answer for an id no record has: 308 to the record that replaced it in `renames.json`, else 404 naming the `noun`. */
export function missing(
  reply: FastifyReply,
  catalogue: Catalogue,
  kind: string,
  id: string,
  noun: string,
): FastifyReply {
  const now = catalogue.renamed(kind, id)
  return now
    ? reply.redirect(`${API_PREFIX}/${kind}/${now}`, 308)
    : reply.notFound(`${noun} ${id} not found`)
}

/** The JSON Schema of a route's path parameters or query string. */
interface ObjectSchema {
  type: 'object'
  properties: Record<string, object>
  required?: readonly string[]
  additionalProperties?: boolean
}

/** Path parameters of a `/:id` read route: `id` is a record id. */
export const idParams: ObjectSchema = {
  type: 'object',
  properties: { id: { type: 'string', pattern: recordIdPattern, description: 'Record id.' } },
  required: ['id'],
}

/** Query of a list without parameters: any key is refused. */
export const noQuery: ObjectSchema = { type: 'object', properties: {}, additionalProperties: false }

/** Query of a paged list: `q` (1 to 100 characters) searches, `filters` are the list's own parameters, `limit` is the page size (1 to 200, default 50), `offset` the items skipped. */
export function listQuery(filters: Record<string, object>): ObjectSchema {
  return {
    type: 'object',
    properties: {
      q: {
        type: 'string',
        minLength: 1,
        maxLength: 100,
        pattern: noControl,
        description: 'Search text.',
      },
      ...filters,
      limit: {
        type: 'integer',
        minimum: 1,
        maximum: 200,
        default: 50,
        description: 'Items per page.',
      },
      offset: {
        type: 'integer',
        minimum: 0,
        maximum: Number.MAX_SAFE_INTEGER,
        default: 0,
        description: 'Items skipped before the page.',
      },
    },
    additionalProperties: false,
  }
}

/** Response schema of a list: `total` and the `items` of the page. */
export const page = <T extends z.ZodType>(item: T) =>
  z.object({ total: z.number(), items: z.array(item) })
