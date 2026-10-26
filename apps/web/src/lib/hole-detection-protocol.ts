/** Messages between the target editor and the hole detection worker, in photo px of the turned photo. */
import type { TargetFace } from '@open-reloading/schema'
import type { FlaggedRegion, HoleExample, HoleProposal } from './hole-detection.ts'
import type { FaceGeometry, FaceSearch } from './target-face.ts'
import type { Point } from './target-geometry.ts'

export type Rgb = { r: number; g: number; b: number }

export type Photo = {
  photo: Blob
  /** The photo's size as the editor shows it; a decode of another size is refused. */
  width: number
  height: number
  /** The photo's turn on screen, rad counter-clockwise about its middle. */
  photoRotation: number
}

type Search = {
  /** The marked region; absent: the target face, else the target the module finds in the whole turned photo. */
  region?: Point[]
  /** The face recognised or chosen: its outline is the region and its black area the background. */
  face?: FaceGeometry
  pxPerM: number
  /** Expected hole diameter, m. */
  holeDiameter: number
  minContrast: number
}

export type WorkerRequest =
  | (Photo &
      Search & {
        kind: 'detect'
        backing?: Rgb
        polarity?: 'dark' | 'light'
        /** Try hole sizes around `holeDiameter` (the bullet) and keep the one the holes show (`autoDetect`). */
        auto?: boolean
      })
  | (Photo & { kind: 'colour'; at: Point; radius: number })
  /** The face search over the whole turned photo against `faces`; `pxPerMm` is the photo's known scale. */
  | (Photo & { kind: 'face'; faces: TargetFace[]; pxPerMm?: number })
  /** Detection from the hole under `at` (`detectFromExample`); `holeDiameter` sets the sizes it tries. */
  | (Photo & Search & { kind: 'example'; at: Point })

export type WorkerReply =
  | { kind: 'progress'; done: number }
  | {
      kind: 'proposals'
      proposals: HoleProposal[]
      flagged: FlaggedRegion[]
      /** The hole size an auto or example run kept, m; absent when it kept none. */
      holeDiameter?: number
      /** What the picked hole showed; absent when no hole was found there. */
      example?: HoleExample
    }
  | { kind: 'colour'; rgb: Rgb }
  /** The search on the photo's px; `fits` is empty when no face is proposed. */
  | { kind: 'face'; search: FaceSearch }
  | { kind: 'error'; message: string }
