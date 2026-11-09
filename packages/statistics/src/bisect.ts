/** `below(x)` is true while x lies below the root; runs `iterations` halvings, with `stopAtEnds` stopping once the midpoint equals an end of the bracket, and returns the last midpoint; each caller keeps its own count and stop rule. */
export function bisect(
  below: (x: number) => boolean,
  bracket: readonly [low: number, high: number],
  iterations: number,
  stopAtEnds: boolean,
): number {
  let [lo, hi] = bracket
  for (let i = 0; i < iterations; i++) {
    const mid = (lo + hi) / 2
    if (stopAtEnds && (mid === lo || mid === hi)) break
    if (below(mid)) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}
