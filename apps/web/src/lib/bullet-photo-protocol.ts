/** Messages between the bullet photo tool and its worker; every px is a px of the working image the tool shows. */
import type { Scale } from './bullet-photo.ts'
import type { BulletMeasurement } from './bullet-photo-measure.ts'
import type { Outline } from './bullet-photo-outline.ts'
import type { Known } from './bullet-photo-scale.ts'
import type { Point } from './target-geometry.ts'

export type WorkerRequest =
  /** The working image as RGBA, row by row; the worker keeps its grey. */
  | { kind: 'load'; id: number; width: number; height: number; data: ArrayBuffer }
  /** Cuts the bullet out of the loaded image, away from the points placed on the ruler. */
  | { kind: 'segment'; id: number; exclude: Point[] }
  /** Outlines and measures a cut-out (its coverage, 0 to 255, row by row); `angle` fixes the axis (base to tip, rad). */
  | {
      kind: 'measure'
      id: number
      alpha: Uint8Array
      width: number
      height: number
      /** The scale of the ruler's points; absent without a ruler. */
      scale?: Scale | undefined
      /** Sizes measured with a caliper: they give the scale without a ruler and check it with one. */
      known?: Known | undefined
      angle?: number | undefined
      /** The width the cut-out's edge is spread over, px, as `segmented` told; absent for a cut-out corrected by hand. */
      edgeSpread?: number | undefined
    }

export type WorkerReply =
  | { kind: 'loaded'; id: number }
  | { kind: 'segmented'; id: number; alpha: Uint8Array; warnings: string[]; edgeSpread: number }
  /** `outline` is absent when no bullet is outlined; the measurement is absent then too, and when the photograph is too poor to measure (`unusable` says why). */
  | {
      kind: 'measured'
      id: number
      outline?: Outline
      measurement?: BulletMeasurement
      /** The scale the measurement is made at: the ruler's, else the known sizes'; absent when there is none and the values are in px. */
      scale?: Scale
      hints: string[]
      unusable?: string
    }
  | { kind: 'error'; id: number; message: string }
