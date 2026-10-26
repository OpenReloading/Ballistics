/** Huber loss for `logLeastSquares`, `apps/docs/docs/models/least-squares.md`, "Huber loss". */

/** Huber loss on the first `count` weighted residuals; the rest stay quadratic. */
export interface HuberLoss {
  /** Residuals beyond this many sigmas count linearly. */
  threshold: number
  /** Number of leading observations the loss applies to. */
  count: number
}

/** Huber loss of a weighted residual: r^2 up to `k`, then 2k|r| - k^2. */
const huberLoss = (r: number, k: number) => (Math.abs(r) <= k ? r * r : 2 * k * Math.abs(r) - k * k)

/** The cost: the Huber loss on the first `count` residuals, squares on the rest. */
export const huberCost = (r: number[], { threshold, count }: HuberLoss) =>
  r.reduce((sum, x, i) => sum + (i < count ? huberLoss(x, threshold) : x * x), 0)

/** Square roots of the reweighting weights: 1, or sqrt(k/|r|) beyond the threshold. */
export const huberRoots = (r: number[], huber: HuberLoss | undefined) =>
  r.map((x, i) =>
    huber && i < huber.count && Math.abs(x) > huber.threshold
      ? Math.sqrt(huber.threshold / Math.abs(x))
      : 1,
  )
