import type { Catalogued, CatalogueKind } from '@open-reloading/use-cases/catalog'
import type { FastifyReply } from 'fastify'

/** A record as the routes answer it: the stored record without the `kind`, `origin` and `revision` that `Catalogue.get` adds. */
export function stored<K extends CatalogueKind>(record: Catalogued<K>) {
  const { kind, origin, revision, ...rest } = record
  return rest
}

/** A record as {@link stored} gives it, with its `revision`. */
export function revised<K extends CatalogueKind>(record: Catalogued<K>) {
  return { ...stored(record), revision: record.revision }
}

/** A record with its `origin` and `revision`, without the `kind`, for a kind whose schema carries `origin`. */
export function originated<K extends CatalogueKind>(record: Catalogued<K>) {
  const { kind, ...rest } = record
  return rest
}

/** The answer for an id no record has: 404 naming the `noun`. */
export function missing(reply: FastifyReply, id: string, noun: string): FastifyReply {
  return reply.notFound(`${noun} ${id} not found`)
}
