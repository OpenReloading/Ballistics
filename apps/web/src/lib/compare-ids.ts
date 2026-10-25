/** The bullet compare view's `ids` parameter and the links to it. */
import { commonCaliber } from './caliber.ts'

/** Most bullets the compare view takes (4), checked before any request. */
export const maxComparedBullets = 4

/** A record id as the data package names its files. */
const idPattern = /^[a-z0-9][a-z0-9-]{0,79}$/

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
  const bad = ids.filter((id) => !idPattern.test(id))
  return bad.length > 0 ? { status: 'invalid', ids: bad } : { status: 'ok', ids }
}

export const compareHref = (ids: readonly string[]) => `/bullets/compare?ids=${ids.join(',')}`

/**
 * A bullet record's "Compare": the bullet list searched by its common caliber with the bullet
 * ticked (`pick`), so one more tick opens the comparison.
 */
export const compareFrom = (id: string, diameterMm: number) =>
  `/bullets?${new URLSearchParams({ q: commonCaliber(diameterMm), pick: id })}`
