/** A sheet copy kept while the page closes, until its save lands. */
type WaitingCopy = { id: string; saved: string }

/** Close-the-page copies: `add` merged into `list` by id, the newer `saved` kept. */
export function mergeWaitingCopies<T extends WaitingCopy>(list: T[], add: T[]): T[] {
  const byId = new Map(list.map((r) => [r.id, r]))
  for (const r of add) {
    const old = byId.get(r.id)
    if (!old || old.saved < r.saved) byId.set(r.id, r)
  }
  return [...byId.values()]
}

/** The copies without sheet `id` once a save of `saved` landed; without `saved` (a delete), every one. */
export const withoutWaitingCopy = <T extends WaitingCopy>(list: T[], id: string, saved?: string) =>
  list.filter((r) => r.id !== id || (saved !== undefined && r.saved > saved))

/** A sheet edit another tab's newer save would lose, kept under `id` as "<name> (copy)" (200 characters at most). */
export const keptCopy = <T extends { id: string; name: string; saved: string }>(
  r: T,
  id: string,
): T => ({
  ...r,
  id,
  name: `${r.name.slice(0, 193)} (copy)`,
})

/** The note on a `keptCopy`. */
export const keptNote = (name: string) => `Changed in another tab: your edits are kept as ${name}.`
