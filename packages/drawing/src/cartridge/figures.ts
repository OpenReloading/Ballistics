import type { SpecValue } from '../core/types.ts'
import {
  cipProfile,
  closedFront,
  drawnTables,
  type Note,
  type Profile,
  shotshellProfile,
  shotshellVariants,
} from './profile.ts'

/** The two sides of a record that a figure draws. */
export type Side = 'cartridge' | 'chamber'

/** The display name of each side, used in the texts about a side that is not drawn. */
export const sideName = { cartridge: 'Cartridge', chamber: 'Chamber' }

/** One figure of a record: the sides drawn (none when no side draws) and the caption notes. */
export interface Figure {
  /** `<record id>-drawing`, or `<record id>-drawing-<k>` for the variant at index k. */
  id: string
  variant?: string | undefined
  drawn: { side: Side; p: Profile }[]
  /**
   * closedFront first, then per side its missing symbols (code `missing`) or its notes; a note of
   * a drawn side carries the number of its flag.
   */
  notes: { code: string; text: string; flagNumber?: number | undefined }[]
}

/** The notes of the drawn sides, numbered from 1 in caption order, or by their figure: each has a flag. */
export const flagged = (drawn: { side: Side; p: Profile }[]) =>
  drawn
    .flatMap(({ side, p }) => p.notes.map((note) => ({ side, note })))
    .map((f, k) => ({ ...f, n: f.note.flagNumber ?? k + 1 }))

/**
 * The figures drawn for a cartridge record (`id`: its C.I.P. sheet id): CIP tables I to V and VIII
 * to X one figure (the chamber only behind a closed front), table VII one per variant of l.
 */
export function recordFigures(spec: {
  id: string
  standard: string
  table?: string | undefined
  values: SpecValue[]
}): Figure[] {
  const cip = spec.standard === 'CIP'
  const shotshells = cip && spec.table === 'VII'
  const drawable = cip && drawnTables.has(spec.table ?? '')
  const closed = drawable ? closedFront(spec.values) : undefined
  const sideList = closed ? (['chamber'] as const) : (['cartridge', 'chamber'] as const)
  return (shotshells ? shotshellVariants(spec.values) : [undefined]).map((variant, k): Figure => {
    let flags = 0
    // each note of a drawn side numbered in the figure, so a side drawn alone keeps its numbers
    const sides = (
      shotshells
        ? sideList.map((side) => ({ side, p: shotshellProfile(spec.values, side, variant) }))
        : drawable
          ? sideList.map((side) => ({ side, p: cipProfile(spec.values, side, spec.table) }))
          : []
    ).map(({ side, p }) => ({
      side,
      p:
        'missing' in p
          ? p
          : { ...p, notes: p.notes.map((note) => ({ ...note, flagNumber: ++flags })) },
    }))
    const drawn = sides.flatMap(({ side, p }) => ('missing' in p ? [] : [{ side, p }]))
    return {
      // the index in the variant list keeps each figure's id whether or not others draw
      id: variant === undefined ? `${spec.id}-drawing` : `${spec.id}-drawing-${k}`,
      variant,
      drawn,
      notes: [
        ...(closed ? [closed] : []),
        ...sides.flatMap(({ side, p }) =>
          'missing' in p
            ? [
                {
                  code: 'missing',
                  text: `${sideName[side]} not drawn: missing ${p.missing.join(', ')}.`,
                },
              ]
            : p.notes,
        ),
      ].map((note) => {
        const { flagNumber: n } = note as Note
        return { code: note.code, text: note.text, ...(n ? { flagNumber: n } : {}) }
      }),
    }
  })
}
