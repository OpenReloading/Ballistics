import { cartridge, caseCapacity, caseTypes } from '@openreloading/schema'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import type { Db } from '../db/index.ts'
import { type CartridgeListParams, getCartridge, listCartridges } from '../db/queries.ts'
import { idParams, listQuery, noNul } from './common.ts'

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
// the table holds an empty list for a cartridge without aliases
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

/** `GET /cartridges` and `GET /cartridges/:id`. */
// biome-ignore lint/suspicious/useAwait: FastifyPluginAsync returns a promise
export const cartridgeRoutes: FastifyPluginAsync<{ db: Db }> = async (app, { db }) => {
  app.get<{ Querystring: CartridgeListParams }>(
    '/cartridges',
    {
      schema: { querystring: cartridgeQuery },
      config: {
        response: listResponse,
        summary: 'List cartridges',
        description:
          'A page of cartridges ordered by name. `q` matches names and aliases. Each item carries its smallest CIP bullet, bore and groove diameters, case and cartridge lengths (mm), its highest Pmax (bar) and the case type from its rim and belt dimensions.',
      },
    },
    async (request) => listCartridges(db, request.query),
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
    async (request, reply) => {
      const cartridge = await getCartridge(db, request.params.id)
      if (!cartridge) return reply.notFound(`cartridge ${request.params.id} not found`)
      return cartridge
    },
  )
}
