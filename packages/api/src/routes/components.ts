import { bullet, constructionFields, manufacturer, powder } from '@open-reloading/schema'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import {
  type ComponentListParams,
  getBullet,
  getManufacturer,
  getPowder,
  listBullets,
  listManufacturers,
  listPowders,
} from '../db/component-queries.ts'
import type { Db } from '../db/index.ts'
import { idParams, listQuery, page, recordIdPattern } from './common.ts'

const powderQuery = listQuery({
  manufacturer: {
    type: 'string',
    pattern: recordIdPattern,
    maxLength: 100,
    description: 'Manufacturer id: only its products.',
  },
})

const bulletQuery = {
  ...powderQuery,
  properties: {
    ...powderQuery.properties,
    cartridge: {
      type: 'string',
      pattern: recordIdPattern,
      maxLength: 100,
      description:
        'Cartridge id: only bullets that fit its CIP bullet diameter G1, bore F and groove Z.',
    },
  },
} as const

// response bodies for the contract document (`openapi.ts`), from the record schemas
const powderList = page(
  z.object({
    id: powder.shape.id,
    manufacturer: powder.shape.manufacturer,
    name: powder.shape.name,
    grainForm: powder.shape.grainForm,
    propellantBase: powder.shape.propellantBase,
    country: powder.shape.country,
    interior: powder.shape.interior
      .unwrap()
      .pick({ vivacity: true, pressureExponent: true, referencePressure: true, burnForm: true })
      .optional(),
  }),
)

const { structure, core } = constructionFields.shape
const bulletList = page(
  z.object({
    id: bullet.shape.id,
    manufacturer: bullet.shape.manufacturer,
    name: bullet.shape.name,
    // the values of the record's diameter (mm), mass (g), length (mm) and first G1 and G7 coefficients
    diameter: z.number(),
    mass: z.number(),
    length: z.number().nullable(),
    ballisticCoefficientG1: z.number().nullable(),
    ballisticCoefficientG7: z.number().nullable(),
    country: bullet.shape.country,
    tipType: bullet.shape.tip.unwrap().shape.type.optional(),
    construction: z
      .union([structure.unwrap(), z.templateLiteral([core.unwrap().shape.material, '-core'])])
      .optional(),
  }),
)

const manufacturerList = page(
  manufacturer.pick({ id: true, name: true, aliases: true, website: true }),
)

/** `GET /manufacturers`, `GET /powders`, `GET /bullets` and their `/:id` routes. */
// biome-ignore lint/suspicious/useAwait: FastifyPluginAsync returns a promise
export const componentRoutes: FastifyPluginAsync<{ db: Db }> = async (app, { db }) => {
  app.get(
    '/manufacturers',
    {
      config: {
        response: manufacturerList,
        summary: 'List manufacturers',
        description: 'Every manufacturer with its aliases and website, ordered by name.',
      },
    },
    async () => listManufacturers(db),
  )
  app.get<{ Params: { id: string } }>(
    '/manufacturers/:id',
    {
      schema: { params: idParams },
      config: {
        response: manufacturer,
        errors: [404],
        summary: 'Get a manufacturer',
        description: 'The manufacturer record with its provenance.',
      },
    },
    async (request, reply) => {
      const record = await getManufacturer(db, request.params.id)
      if (!record) return reply.notFound(`manufacturer ${request.params.id} not found`)
      return record
    },
  )
  for (const [path, list, get, noun, querystring, listResponse, record, listText] of [
    [
      '/powders',
      listPowders,
      getPowder,
      'powder',
      powderQuery,
      powderList,
      powder,
      'Each item carries the burn parameters of its interior model where the record has them.',
    ],
    [
      '/bullets',
      listBullets,
      getBullet,
      'bullet',
      bulletQuery,
      bulletList,
      bullet,
      'Each item carries diameter (mm), mass (g), length (mm), the first G1 and G7 ballistic coefficients, tip type and construction.',
    ],
  ] as const) {
    app.get<{ Querystring: ComponentListParams }>(
      path,
      {
        schema: { querystring },
        config: {
          response: listResponse,
          summary: `List ${noun}s`,
          description: `A page of ${noun}s ordered by manufacturer name, name and id. \`q\` matches the manufacturer name or an alias followed by the product name. ${listText}`,
        },
      },
      async (request) => list(db, request.query),
    )
    app.get<{ Params: { id: string } }>(
      `${path}/:id`,
      {
        schema: { params: idParams },
        config: {
          response: record,
          errors: [404],
          summary: `Get a ${noun}`,
          description: `The whole ${noun} record with its provenance.`,
        },
      },
      async (request, reply) => {
        const record = await get(db, request.params.id)
        if (!record) return reply.notFound(`${noun} ${request.params.id} not found`)
        return record
      },
    )
  }
}
