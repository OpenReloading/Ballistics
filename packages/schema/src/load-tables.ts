import { z } from 'zod'
import type { Exact } from './exact.ts'
import { recordId } from './ids.ts'
import { source } from './provenance.ts'

const loadTableParser = z.strictObject({
  manufacturer: recordId,
  title: source.shape.title.unwrap(),
  url: source.shape.url,
  retrieved: z.iso.date(),
})

/**
 * A manufacturer load table a powder fit reads: the entry of one row file in `load-tables.json`
 * of a records folder. A fitted source names the table by `title`, `url` and `retrieved`.
 * Inferred type: {@link LoadTable}.
 */
export const loadTable: z.ZodObject<
  {
    /** Id of the manufacturer record that publishes the table. */
    manufacturer: typeof recordId
    title: z.ZodString
    url: z.ZodOptional<z.ZodURL>
    retrieved: z.ZodISODate
  },
  z.core.$strict
> = loadTableParser satisfies Exact<typeof loadTable, typeof loadTableParser>

/** One listed load table: its manufacturer, title, URL and retrieval date. */
export interface LoadTable extends z.infer<typeof loadTable> {}

const loadTablesParser = z.record(z.string().min(1), loadTable)

/**
 * `load-tables.json`: the listed load tables by the name of their row file.
 * Inferred type: {@link LoadTables}.
 */
export const loadTables: z.ZodRecord<z.ZodString, typeof loadTable> =
  loadTablesParser satisfies Exact<typeof loadTables, typeof loadTablesParser>

/** The listed load tables by row file. */
export type LoadTables = z.infer<typeof loadTables>
