import { recordIdRegex } from '@openreloading/schema'
import { z } from 'zod'

/** `pattern` of a query string value without a NUL character: PostgreSQL text holds none, so the query would fail with 500. */
export const noNul = '^[^\\u0000]*$'

/** `pattern` of a record id, as `recordId` of `@openreloading/schema`. */
export const recordIdPattern = recordIdRegex.source

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

/**
 * Query of a paged list: `q` (1 to 100 characters) searches the list, `filters` are the list's own
 * parameters, `limit` is the page size (1 to 200, default 50) and `offset` the items skipped.
 */
export function listQuery(filters: Record<string, object>): ObjectSchema {
  return {
    type: 'object',
    properties: {
      q: {
        type: 'string',
        minLength: 1,
        maxLength: 100,
        pattern: noNul,
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

/** Response schema of a list for the contract document: `total` and the `items` of the page. */
export const page = <T extends z.ZodType>(item: T) =>
  z.object({ total: z.number(), items: z.array(item) })
