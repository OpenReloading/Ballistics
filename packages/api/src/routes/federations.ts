import {
  caliberClass,
  discipline,
  disciplineCategory,
  federation,
  recordId,
  targetFace,
  targetMapping,
} from '@openreloading/schema'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import type { Catalogue } from '../catalogue/types.ts'
import { idParams, missing, page, recordIdPattern, stored } from './common.ts'

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
    federation: targetFace.shape.federation,
    organization: z
      .string()
      .optional()
      .describe("Abbreviation of the face's federation, as the rule books print it."),
    name: targetFace.shape.name,
    caliberClasses: z.array(recordId),
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
const caliberClassList = page(
  caliberClass.pick({ id: true, name: true }).extend({ diameterMm: z.number() }),
)
const mappingList = page(
  targetMapping.pick({ id: true, discipline: true, face: true, event: true, stage: true }).extend({
    gaugeMm: z.number().optional(),
  }),
)

/** `GET /target-faces`, `GET /federations`, `GET /disciplines`, `GET /target-mappings`, `GET /caliber-classes` and their `/:id` routes. */
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
          'Every target face with its federation, the caliber classes of the disciplines mapped to it and the categories of its events and those disciplines. Ordered by federation, then the code printed in the name, then name.',
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
        moved: true,
        summary: 'Get a target face',
        description:
          'The target face record: federation id, ring diameters (mm), inner ten, events with their ids and provenance.',
      },
    },
    (request, reply) => {
      const record = catalogue.get('targetFace', request.params.id)
      if (!record)
        return missing(reply, catalogue, 'target-faces', request.params.id, 'target face')
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
  app.get(
    '/caliber-classes',
    {
      config: {
        response: caliberClassList,
        summary: 'List caliber classes',
        description:
          'The caliber classes the disciplines name: groups of cartridges whose bullets have the same diameter, with the nominal diameter (mm), ordered by diameter.',
      },
    },
    (_request, reply) => reply.send(catalogue.caliberClasses()),
  )
  for (const [path, kind, noun, record] of [
    ['/federations', 'federation', 'federation', federation],
    ['/disciplines', 'discipline', 'discipline', discipline],
    ['/target-mappings', 'targetMapping', 'target mapping', targetMapping],
    ['/caliber-classes', 'caliberClass', 'caliber class', caliberClass],
  ] as const) {
    app.get<{ Params: { id: string } }>(
      `${path}/:id`,
      {
        schema: { params: cappedIdParams },
        config: {
          response: record,
          errors: [404],
          moved: true,
          summary: `Get a ${noun}`,
          description: `The whole ${noun} record with its provenance.`,
        },
      },
      (request, reply) => {
        const found = catalogue.get(kind, request.params.id)
        if (!found) return missing(reply, catalogue, path.slice(1), request.params.id, noun)
        return reply.send(stored(found))
      },
    )
  }
}
