import {
  bullet,
  cartridgeCase,
  constructionFields,
  manufacturer,
  powder,
  primer,
  primerCompounds,
  primerSizes,
  recordId,
} from '@open-reloading/schema'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import type {
  BulletQuery,
  CaseQuery,
  Catalogue,
  Catalogued,
  PrimerQuery,
} from '../catalogue/types.ts'
import {
  idParams,
  listQuery,
  missing,
  noQuery,
  originated,
  page,
  recordIdPattern,
  revised,
  revision,
  stored,
} from './common.ts'

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

const primerQuery = {
  ...powderQuery,
  properties: {
    ...powderQuery.properties,
    size: {
      type: 'string',
      enum: primerSizes.options,
      description: 'Primer size: only the primers of that size.',
    },
    compound: {
      type: 'string',
      enum: primerCompounds.options,
      description: 'Priming compound: only the primers with it.',
    },
  },
} as const

const caseQuery = {
  ...powderQuery,
  properties: {
    ...powderQuery.properties,
    cartridge: {
      type: 'string',
      pattern: recordIdPattern,
      maxLength: 100,
      description: 'Cartridge id: only the cases made for it.',
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
    diameter: z.number().nullable(),
    mass: z.number(),
    length: z.number().nullable(),
    ballisticCoefficientG1: z.number().nullable(),
    ballisticCoefficientG7: z.number().nullable(),
    country: bullet.shape.country,
    tipType: bullet.shape.tip.unwrap().shape.type.optional(),
    baseType: bullet.shape.base.unwrap().shape.type.optional(),
    construction: z
      .union([structure.unwrap(), z.templateLiteral([core.unwrap().shape.material, '-core'])])
      .optional(),
    // derived from the construction (`leadFree` of the schema); absent where it does not settle it
    leadFree: z.boolean().optional(),
    nameOnly: bullet.shape.nameOnly,
  }),
)

const primerList = page(
  z.object({
    id: recordId,
    manufacturer: recordId,
    name: primer.shape.name,
    productNumber: primer.shape.productNumber,
    size: primer.shape.size,
    magnum: primer.shape.magnum,
    compound: primer.shape.compound,
  }),
)

const caseList = page(
  z.object({
    id: recordId,
    manufacturer: recordId,
    cartridge: recordId,
    name: z.string(),
    productNumber: z.string(),
    material: cartridgeCase.shape.material,
    // the stated water capacity and the empty mass of the record, g
    waterCapacity: z.number().optional(),
    mass: z.number().optional(),
  }),
)

const manufacturerList = page(
  manufacturer.pick({ id: true, name: true, aliases: true, website: true }),
)

/** `GET /manufacturers`, `GET /powders`, `GET /primers`, `GET /bullets`, `GET /cases` and their `/:id` routes. */
// biome-ignore lint/suspicious/useAwait: FastifyPluginAsync returns a promise
export const componentRoutes: FastifyPluginAsync<{ catalogue: Catalogue }> = async (
  app,
  { catalogue },
) => {
  app.get(
    '/manufacturers',
    {
      schema: { querystring: noQuery },
      config: {
        response: manufacturerList,
        summary: 'List manufacturers',
        description:
          'Every manufacturer with its aliases and website, ordered by name, digit runs in numeric order.',
      },
    },
    (_request, reply) => reply.send(catalogue.manufacturers()),
  )
  app.get<{ Params: { id: string } }>(
    '/manufacturers/:id',
    {
      schema: { params: idParams },
      config: {
        response: manufacturer,
        errors: [404],
        moved: true,
        summary: 'Get a manufacturer',
        description: 'The manufacturer record with its provenance.',
      },
    },
    (request, reply) => {
      const record = catalogue.get('manufacturer', request.params.id)
      if (!record)
        return missing(reply, catalogue, 'manufacturers', request.params.id, 'manufacturer')
      return reply.send(stored(record))
    },
  )
  for (const [path, noun, querystring, listResponse, record, listText] of [
    [
      '/powders',
      'powder',
      powderQuery,
      powderList,
      powder,
      'Each item carries the burn parameters of its interior model where the record has them.',
    ],
    [
      '/bullets',
      'bullet',
      bulletQuery,
      bulletList,
      bullet.extend({ revision }),
      'Each item carries diameter (mm, null where the record has none), mass (g), length (mm), the first G1 and G7 ballistic coefficients, tip type and construction. A record that only names the bullet carries nameOnly.',
    ],
  ] as const) {
    app.get<{ Querystring: BulletQuery }>(
      path,
      {
        schema: { querystring },
        config: {
          response: listResponse,
          summary: `List ${noun}s`,
          description: `A page of ${noun}s ordered by manufacturer name and name, digit runs in numeric order. \`q\` keeps the ${noun}s whose manufacturer name or alias followed by the product name holds every word of it, in any order, and ranks them by match, ties in the default order. ${listText}`,
        },
      },
      (request, reply) =>
        reply.send(
          noun === 'powder' ? catalogue.powders(request.query) : catalogue.bullets(request.query),
        ),
    )
    app.get<{ Params: { id: string } }>(
      `${path}/:id`,
      {
        schema: { params: idParams },
        config: {
          response: record,
          errors: [404],
          moved: true,
          summary: `Get a ${noun}`,
          description: `The whole ${noun} record with its provenance.${noun === 'bullet' ? ' `revision` is a hash of the stored record that changes with any field.' : ''}`,
        },
      },
      (request, reply) => {
        const found = catalogue.get(noun, request.params.id)
        if (!found) return missing(reply, catalogue, `${noun}s` as const, request.params.id, noun)
        return reply.send(
          noun === 'bullet' ? revised(found as Catalogued<'bullet'>) : stored(found),
        )
      },
    )
  }
  app.get<{ Querystring: PrimerQuery }>(
    '/primers',
    {
      schema: { querystring: primerQuery },
      config: {
        response: primerList,
        summary: 'List primers',
        description:
          'A page of primer products ordered by manufacturer name and name, digit runs in numeric order. `q` keeps the primers whose manufacturer name or alias followed by the product name, or by the product number, holds every word of it, in any order, and ranks them by match. `size` and `compound` keep one size and one priming compound. Each item carries the size, the magnum flag and the priming compound where the record has them.',
      },
    },
    (request, reply) => reply.send(catalogue.primers(request.query)),
  )
  app.get<{ Params: { id: string } }>(
    '/primers/:id',
    {
      schema: { params: idParams },
      config: {
        response: primer,
        errors: [404],
        moved: true,
        summary: 'Get a primer',
        description: 'The whole primer record with its provenance.',
      },
    },
    (request, reply) => {
      const found = catalogue.get('primer', request.params.id)
      if (!found) return missing(reply, catalogue, 'primers', request.params.id, 'primer')
      return reply.send(stored(found))
    },
  )
  app.get<{ Querystring: CaseQuery }>(
    '/cases',
    {
      schema: { querystring: caseQuery },
      config: {
        response: caseList,
        summary: 'List cases',
        description:
          'A page of cartridge case products ordered by manufacturer name and name, digit runs in numeric order. `q` keeps the cases whose manufacturer name or alias followed by the product name, or by the product number, holds every word of it, in any order, and ranks them by match. Each item carries the cartridge and manufacturer ids, the material, and the stated water capacity (g) and empty mass (g) where the record has them.',
      },
    },
    (request, reply) => reply.send(catalogue.cases(request.query)),
  )
  app.get<{ Params: { id: string } }>(
    '/cases/:id',
    {
      schema: { params: idParams },
      config: {
        // a catalogue case always names its manufacturer
        response: cartridgeCase.safeExtend({
          manufacturer: cartridgeCase.shape.manufacturer.unwrap(),
          revision,
        }),
        errors: [404],
        moved: true,
        summary: 'Get a case',
        description:
          'The whole case record with its provenance and `origin`. `revision` is a hash of the stored record that changes with any field.',
      },
    },
    (request, reply) => {
      const found = catalogue.get('case', request.params.id)
      if (!found) return missing(reply, catalogue, 'cases', request.params.id, 'case')
      return reply.send(originated(found))
    },
  )
}
