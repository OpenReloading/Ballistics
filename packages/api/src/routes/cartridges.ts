import { cartridge, caseCapacity, caseTypes } from '@openreloading/schema'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { cartridgeItem } from '../catalogue/derive.ts'
import type { CartridgeQuery, Catalogue } from '../catalogue/types.ts'
import { idParams, listQuery, noNul, stored } from './common.ts'

const cartridgeQuery = listQuery({
  table: {
    type: 'string',
    minLength: 1,
    maxLength: 10,
    pattern: noNul,
    description: 'C.I.P. table of the cartridge (`I` to `XI`).',
  },
})

// response bodies for the contract document (`openapi.ts`), from the record schemas
// a record without aliases answers an empty list
const aliases = z.array(cartridge.shape.aliases.unwrap().element)
const mm = z.number().optional()

const listResponse = z.object({
  total: z.number(),
  items: z.array(
    z.object({
      id: cartridge.shape.id,
      name: cartridge.shape.name,
      aliases,
      table: cartridge.shape.table,
      maxBulletDiameter: mm,
      boreDiameter: mm,
      grooveDiameter: mm,
      caseLength: mm,
      cartridgeLength: mm,
      pmax: z.number().optional(),
      caseType: caseTypes.optional(),
      country: cartridge.shape.country,
    }),
  ),
})

const cartridgeResponse = cartridge.extend({
  aliases,
  caseType: caseTypes.optional(),
  capacities: z.array(caseCapacity),
})

/**
 * The body of `GET /cartridges/:id`: the stored record with its aliases (empty where it has none),
 * case type and case capacities. Undefined for an unknown id. The Pages edition's data files hold
 * the same body.
 */
export function cartridgeAnswer(catalogue: Catalogue, id: string) {
  const found = catalogue.get('cartridge', id)
  if (!found) return
  const record = stored(found)
  const { caseType } = cartridgeItem(record)
  return {
    ...record,
    aliases: record.aliases ?? [],
    ...(caseType && { caseType }),
    capacities: catalogue.capacities(record.id).map(stored),
  }
}

/** `GET /cartridges` and `GET /cartridges/:id`. */
// biome-ignore lint/suspicious/useAwait: FastifyPluginAsync returns a promise
export const cartridgeRoutes: FastifyPluginAsync<{ catalogue: Catalogue }> = async (
  app,
  { catalogue },
) => {
  app.get<{ Querystring: CartridgeQuery }>(
    '/cartridges',
    {
      schema: { querystring: cartridgeQuery },
      config: {
        response: listResponse,
        summary: 'List cartridges',
        description:
          'A page of cartridges ordered by name, digit runs in numeric order. `q` keeps the cartridges whose name or alias holds every word of it, in any order, and ranks them by match (a word that starts a word of the name first), ties in the default order. Each item carries its smallest CIP bullet, bore and groove diameters, case and cartridge lengths (mm), its highest Pmax (bar) and the case type from its rim and belt dimensions.',
      },
    },
    (request, reply) => reply.send(catalogue.cartridges(request.query)),
  )

  app.get<{ Params: { id: string } }>(
    '/cartridges/:id',
    {
      schema: { params: idParams },
      config: {
        response: cartridgeResponse,
        errors: [404],
        summary: 'Get a cartridge',
        description:
          'The cartridge record of its C.I.P. sheet with its values, provenance, case type and case capacities.',
      },
    },
    (request, reply) => {
      const answer = cartridgeAnswer(catalogue, request.params.id)
      if (!answer) return reply.notFound(`cartridge ${request.params.id} not found`)
      return reply.send(answer)
    },
  )
}
