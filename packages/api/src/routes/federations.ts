import {
  caliberClassId,
  discipline,
  disciplineCategory,
  federation,
  targetFace,
  targetMapping,
} from '@openreloading/schema'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import type { Catalogue } from '../catalogue/types.ts'
import { idParams, page, recordIdPattern, stored } from './common.ts'

const id = { type: 'string', pattern: recordIdPattern, maxLength: 100 } as const
const cappedIdParams = {
  type: 'object',
  properties: { id: { ...id, description: 'Record id.' } },
  required: ['id'],
} as const
/** A query of record id filters, each with its description. */
const query = <K extends string>(filters: Record<K, string>) =>
  ({
    type: 'object',
    properties: Object.fromEntries(
      Object.entries(filters).map(([k, description]) => [k, { ...id, description }]),
    ) as Record<K, typeof id & { description: string }>,
    additionalProperties: false,
  }) as const

const targetFaceList = page(
  z.object({
    id: targetFace.shape.id,
    organization: targetFace.shape.organization,
    name: targetFace.shape.name,
    caliberClasses: z.array(caliberClassId),
    categories: z.array(disciplineCategory),
  }),
)
const federationList = page(
  federation.pick({
    id: true,
    name: true,
    abbreviation: true,
    country: true,
    internationalFederation: true,
  }),
)
const disciplineList = page(
  discipline.pick({ id: true, federation: true, name: true, number: true, category: true }).extend({
    distanceMm: z.number(),
  }),
)
const mappingList = page(
  targetMapping.pick({ id: true, discipline: true, face: true, event: true, stage: true }).extend({
    gaugeMm: z.number().optional(),
  }),
)

/** `GET /target-faces`, `GET /federations`, `GET /disciplines`, `GET /target-mappings` and their `/:id` routes. */
// biome-ignore lint/suspicious/useAwait: FastifyPluginAsync returns a promise
export const federationRoutes: FastifyPluginAsync<{ catalogue: Catalogue }> = async (
  app,
  { catalogue },
) => {
  app.get(
    '/target-faces',
    {
      config: {
        response: targetFaceList,
        summary: 'List target faces',
        description:
          'Every target face with its organization, the caliber classes of the disciplines mapped to it and the categories of its events and those disciplines. Ordered by organization, then the code printed in the name, then name.',
      },
    },
    (_request, reply) => reply.send(catalogue.targetFaces()),
  )
  app.get<{ Params: { id: string } }>(
    '/target-faces/:id',
    {
      schema: { params: idParams },
      config: {
        response: targetFace,
        errors: [404],
        summary: 'Get a target face',
        description:
          'The target face record: ring diameters (mm), inner ten, events and provenance.',
      },
    },
    (request, reply) => {
      const record = catalogue.get('targetFace', request.params.id)
      if (!record) return reply.notFound(`target face ${request.params.id} not found`)
      return reply.send(stored(record))
    },
  )
  app.get(
    '/federations',
    {
      config: {
        response: federationList,
        summary: 'List federations',
        description:
          'Every shooting federation with its abbreviation, country and international federation, ordered by abbreviation.',
      },
    },
    (_request, reply) => reply.send(catalogue.federations()),
  )
  app.get<{ Querystring: { federation?: string } }>(
    '/disciplines',
    {
      schema: { querystring: query({ federation: 'Federation id: only its disciplines.' }) },
      config: {
        response: disciplineList,
        summary: 'List disciplines',
        description:
          "The disciplines of every federation, or of one, with number, category and shooting distance (mm), ordered by federation, then the federation's own number (first code, numeric parts in numeric order), then distance and name. Disciplines without a number follow, by category, distance and name.",
      },
    },
    (request, reply) => reply.send(catalogue.disciplines(request.query)),
  )
  app.get<{ Querystring: { discipline?: string; face?: string } }>(
    '/target-mappings',
    {
      schema: {
        querystring: query({
          discipline: 'Discipline id: only its mappings.',
          face: 'Target face id: only its mappings.',
        }),
      },
      config: {
        response: mappingList,
        summary: 'List target mappings',
        description:
          'Which target face a discipline shoots, per event and stage, with the scoring gauge diameter (mm) where one applies, in the order of the disciplines.',
      },
    },
    (request, reply) => reply.send(catalogue.targetMappings(request.query)),
  )
  for (const [path, kind, noun, record] of [
    ['/federations', 'federation', 'federation', federation],
    ['/disciplines', 'discipline', 'discipline', discipline],
    ['/target-mappings', 'targetMapping', 'target mapping', targetMapping],
  ] as const) {
    app.get<{ Params: { id: string } }>(
      `${path}/:id`,
      {
        schema: { params: cappedIdParams },
        config: {
          response: record,
          errors: [404],
          summary: `Get a ${noun}`,
          description: `The whole ${noun} record with its provenance.`,
        },
      },
      (request, reply) => {
        const found = catalogue.get(kind, request.params.id)
        if (!found) return reply.notFound(`${noun} ${request.params.id} not found`)
        return reply.send(stored(found))
      },
    )
  }
}
