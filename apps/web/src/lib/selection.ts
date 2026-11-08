/** Row selection of the directory tables: the ticked ids in the order ticked, at most `max`. */

/** `picked` with `id` ticked or, when it is ticked, unticked. A full selection takes no more. */
export const togglePick = (picked: readonly string[], id: string, max: number) =>
  picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id].slice(0, max)

/** Shift-range: rows between the anchor and `id` take the click's state; without a visible anchor it is a plain toggle. */
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
