import { z } from 'zod'
import type { Exact } from './exact.ts'
import { recordId } from './ids.ts'

const renameKindParser = z.enum([
  'cartridges',
  'manufacturers',
  'powders',
  'primers',
  'bullets',
  'cases',
  'target-faces',
  'federations',
  'disciplines',
  'target-mappings',
  'caliber-classes',
])

/** The record kinds a rename can name: the kind directories that have an id route. */
export const renameKind: z.ZodEnum<
  z.core.util.ToEnum<
    | 'cartridges'
    | 'manufacturers'
    | 'powders'
    | 'primers'
    | 'bullets'
    | 'cases'
    | 'target-faces'
    | 'federations'
    | 'disciplines'
    | 'target-mappings'
    | 'caliber-classes'
  >
> = renameKindParser satisfies Exact<typeof renameKind, typeof renameKindParser>

/** A kind directory of {@link renameKind}. */
export type RenameKind = z.infer<typeof renameKind>

const renamesParser = z
  .partialRecord(renameKind, z.record(recordId, recordId))
  .describe('Old record ids by kind directory, each with the id that replaces it.')

/**
 * `records/renames.json`: per kind, the ids that no longer name a record, each with the id of the
 * record that replaces it (a removed record names its successor). A reference to an old id still
 * resolves, and the API answers a request for it with a permanent redirect.
 */
export const renames: z.ZodRecord<
  typeof renameKind & z.core.$partial,
  z.ZodRecord<typeof recordId, typeof recordId>
> = renamesParser satisfies Exact<typeof renames, typeof renamesParser>

/** The renames of a records root: old id to new id, per kind. */
export type Renames = z.infer<typeof renames>
