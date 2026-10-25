import { z } from 'zod'
import { recordId } from './ids.ts'
import { source } from './provenance.ts'

/**
 * A manufacturer load table a powder fit reads: the entry of one row file in `load-tables.json`
 * of a records folder. A fitted source names the table by `title`, `url` and `retrieved`.
 * Inferred type: {@link LoadTable}.
 */
export const loadTable = z.strictObject({
  /** Id of the manufacturer record that publishes the table. */
  manufacturer: recordId,
  title: source.shape.title,
  url: source.shape.url,
  retrieved: z.iso.date(),
})

/** One listed load table: its manufacturer, title, URL and retrieval date. */
export interface LoadTable extends z.infer<typeof loadTable> {}

/**
 * `load-tables.json`: the listed load tables by the name of their row file.
 * Inferred type: {@link LoadTables}.
 */
export const loadTables = z.record(z.string().min(1), loadTable)

/** The listed load tables by row file. */
export type LoadTables = z.infer<typeof loadTables>
