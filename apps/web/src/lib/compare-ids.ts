/** The bullet compare view's `ids` parameter and the links to it. */
import { recordIdRegex } from '@open-reloading/schema'
import { commonCaliber } from './caliber.ts'

/** Most bullets the compare view takes (4), checked before any request. */
export const maxComparedBullets = 4

/** Longest record id the web app passes on to a request (100 characters), as the API's limit. */
export const maxRecordIdLength = 100

type CompareIds =
  | { status: 'ok'; ids: string[] }
  | { status: 'empty' }
  | { status: 'tooMany'; count: number }
  | { status: 'invalid'; ids: string[] }

/** The `ids` parameter: comma-separated, trimmed, deduplicated; checked before any request. */
export function parseCompareIds(param: string | string[] | undefined): CompareIds {
  const text = Array.isArray(param) ? param[0] : param
  const ids = [
    ...new Set(
      (text ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ]
  if (ids.length === 0) return { status: 'empty' }
  if (ids.length > maxComparedBullets) return { status: 'tooMany', count: ids.length }
  const bad = ids.filter((id) => id.length > maxRecordIdLength || !recordIdRegex.test(id))
  return bad.length > 0 ? { status: 'invalid', ids: bad } : { status: 'ok', ids }
}

export const compareHref = (ids: readonly string[]) => `/bullets/compare?ids=${ids.join(',')}`

/**
 * A bullet record's "Compare": the bullet list searched by its common caliber with the bullet
 * ticked (`pick`), so one more tick opens the comparison. A bullet without a diameter is ticked in the
 * unsearched list.
 */
export const compareFrom = (id: string, diameterMm?: number) =>
  `/bullets?${new URLSearchParams(diameterMm === undefined ? { pick: id } : { q: commonCaliber(diameterMm), pick: id })}`
