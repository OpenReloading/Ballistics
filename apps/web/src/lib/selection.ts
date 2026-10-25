/** Row selection of the directory tables: the ticked ids in the order ticked, at most `max`. */

/** `picked` with `id` ticked or, when it is ticked, unticked. A full selection takes no more. */
export const togglePick = (picked: readonly string[], id: string, max: number) =>
  picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id].slice(0, max)

/**
 * `picked` after a click on the box of `id`. With an `anchor` (the box clicked before) that is in
 * `rows`, every row between the two, `can` permitting, takes the state the click gives `id`:
 * ticked rows are appended in row order up to `max`, unticked ones leave. Without a usable anchor
 * (none yet, or hidden by the search) it is a plain toggle.
 */
export function pickRange<T extends { id: string }>(
  rows: readonly T[],
  picked: readonly string[],
  anchor: string | undefined,
  id: string,
  max: number,
  can: (row: T) => boolean = () => true,
): string[] {
  const from = rows.findIndex((r) => r.id === anchor)
  const to = rows.findIndex((r) => r.id === id)
  if (from < 0 || to < 0) return togglePick(picked, id, max)
  const span = rows
    .slice(Math.min(from, to), Math.max(from, to) + 1)
    .filter(can)
    .map((r) => r.id)
  if (picked.includes(id)) return picked.filter((x) => !span.includes(x))
  return [...picked, ...span.filter((x) => !picked.includes(x))].slice(0, max)
}
