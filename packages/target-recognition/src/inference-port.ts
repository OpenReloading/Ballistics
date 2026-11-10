/** The inference port: the one way from an image buffer to hole proposals, for the classical detector now and a learned model later. */
import type { Point } from '@open-reloading/shot-groups'
import {
  autoDetect,
  detectFromExample,
  type FlaggedRegion,
  findHoles,
  type HoleDetectionInput,
  type HoleExample,
  type HoleProposal,
} from './hole-detection.ts'

/** The image buffer and the run's options: `at` (image px) runs from the hole under it, else `auto` from the region's strongest blobs, else `findHoles`. */
export type ProposalRequest = HoleDetectionInput & {
  at?: Point | undefined
  auto?: boolean | undefined
}

/** The run's proposals and flagged regions in image px of the request's image; `holeDiameter` (m) and `example` come from an example or auto run only. */
export type Proposals = {
  proposals: HoleProposal[]
  flagged: FlaggedRegion[]
  holeDiameter?: number
  example?: HoleExample
}

/** One method from an image buffer to hole proposals; asynchronous because a model runtime answers so. */
export interface InferencePort {
  /** Resolves to the run's proposals in image px, none when an example or auto run finds no holes; rejects with the detector's `RangeError` or `Error` for invalid input. */
  propose(request: ProposalRequest): Promise<Proposals>
}

/** The classical detector of this package, known-weak: it misses the default bar on the holdout photos and stays until a learned model meets an accuracy bar that is not measured yet (`apps/docs/docs/models/hole-detection.md`, "Quality bar"). */
export const holeDetector: InferencePort = {
  propose: async (request) => classical(request),
}

/** The example, auto or plain run, with no proposals where the example or auto run finds none. */
function classical(r: ProposalRequest): Proposals {
  if (r.at) return detectFromExample(r, r.at) ?? { proposals: [], flagged: [] }
  if (r.auto) return autoDetect(r) ?? { proposals: [], flagged: [] }
  return findHoles(r)
}
