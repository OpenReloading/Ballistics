/** Messages between the Import entry and its worker. Files, tables and records stay in the worker; the page gets summaries. */
import type { TableKind } from './fields.ts'
import type { ColumnMap, KindScore, RowIssue, Tier } from './map.ts'

export interface CardView {
  type: 'table' | 'load' | 'refused'
  name: string
  /** Refused: why. Table without a kind: why no kind is suggested. */
  reason?: string
  /** Load file: the format and what was not read. */
  format?: string
  notes?: string[]
  records?: number
  origin?: string
  sheet?: string
  otherSheets?: string[]
  delimiter?: string
  header?: string[]
  rowCount?: number
  /** Up to three non-empty cells per column. */
  samples?: string[][]
  scores?: KindScore[]
  kind?: TableKind
  tier?: Tier
  map?: ColumnMap[]
}

export interface PlanView {
  added: number
  equal: number
  conflicts: { name: string; row?: number }[]
  conflictCount: number
  repeated: number
  makersAdded: number
}

export interface BuildView {
  /** The column map used: the request's, or the automatic one for the kind. */
  map: ColumnMap[]
  rows: number
  accepted: number
  warnings: number
  rejected: number
  /** First rejected rows and warnings, at most `listed` of each. */
  rejectedList: RowIssue[]
  warningList: RowIssue[]
  /** The first records as they are stored: name, then field label and stored value. */
  preview: { name: string; values: Record<string, string> }[]
  plan: PlanView
}

export type Request =
  | { type: 'inspect'; id: number; name: string; bytes: ArrayBuffer }
  | {
      type: 'build'
      id: number
      kind: TableKind
      map?: ColumnMap[]
      source: string
      file: string
      day: string
    }
  | { type: 'commit'; id: number; replace: boolean }
  | { type: 'drop'; id: number }

export type Reply =
  | { type: 'inspected'; id: number; card: CardView; ms: number }
  | { type: 'built'; id: number; build: BuildView; ms: number }
  | { type: 'committed'; id: number; written: number; stored: number }
  | { type: 'failed'; id: number; message: string }

/** How many issues a reply lists. */
export const listed = 100
