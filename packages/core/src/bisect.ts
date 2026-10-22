/**
 * Bisection on [low, high] for the point where `below` turns false: `below(x)` is true while x lies
 * below the root. Runs `iterations` halvings, with `stopAtEnds` it stops early once the midpoint
 * equals an end of the bracket; returns the last midpoint. Each caller keeps its own count and stop
 * rule.
 */
export function bisect(
  below: (x: number) => boolean,
  low: number,
  high: number,
  iterations: number,
  stopAtEnds: boolean,
): number {
  let lo = low
  let hi = high
  for (let i = 0; i < iterations; i++) {
    const mid = (lo + hi) / 2
    if (stopAtEnds && (mid === lo || mid === hi)) break
    if (below(mid)) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}
