import { canonicalJson } from '@rangefoundry/schema'
import { type Catalogue, sha256 } from '@rangefoundry/use-cases/catalog'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { API_VERSION } from '../version.ts'

/** The body, the query of a request without a body, both where a request has both and a non-empty query. */
function inputOf({ body, query }: FastifyRequest) {
  if (body === undefined) return query
  return Object.keys(query ?? {}).length > 0 ? { body, query } : body
}

/**
 * Adds `inputHash`, `apiVersion` and `dataHash` to every 200 answer of the routes of `app`, so a
 * saved answer can be checked against a later run. Errors carry none. Registered on a route
 * plugin, it applies to that plugin's routes only.
 */
export function describeAnswers(app: FastifyInstance, catalogue: Catalogue) {
  app.addHook('preSerialization', async (request, reply, payload) => {
    if (reply.statusCode !== 200 || payload === null || typeof payload !== 'object') return payload
    return {
      ...payload,
      inputHash: await sha256(canonicalJson(inputOf(request))),
      apiVersion: API_VERSION,
      dataHash: await catalogue.dataHash(),
    }
  })
}
