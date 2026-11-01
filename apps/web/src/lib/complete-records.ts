/**
 * Incomplete catalogue records: a bullet that only names itself (`nameOnly`, no diameter or length
 * as a rule) and a powder without burn values (no interior model), which cannot run.
 */

/** A bullet record or list item that only names the bullet. */
export const bulletIncomplete = (b: { nameOnly?: true | undefined }) => b.nameOnly === true

/** A powder list item without the burn values of an interior model. */
export const powderIncomplete = (p: { interior?: unknown }) => p.interior === undefined

/** A powder row of a list or chooser without the burn values of an interior model, a design's included. */
export const powderRowIncomplete = (r: { modelled?: true | undefined }) => r.modelled !== true

/**
 * `items` with the complete ones first, in their order, then the incomplete ones; without them
 * when `completeOnly`.
 */
export function completeFirst<T>(
  items: readonly T[],
  incomplete: (item: T) => boolean,
  completeOnly: boolean,
): T[] {
  const complete = items.filter((i) => !incomplete(i))
  return completeOnly ? complete : [...complete, ...items.filter(incomplete)]
}
