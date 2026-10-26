/** Messages between the bullet photo tool and its worker; every px is a px of the working image the tool shows. */
import type { Scale } from './bullet-photo.ts'
import type { BulletMeasurement } from './bullet-photo-measure.ts'
import type { Outline } from './bullet-photo-outline.ts'
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
      scale: Scale
      angle?: number | undefined
    }

export type WorkerReply =
  | { kind: 'loaded'; id: number }
  | { kind: 'segmented'; id: number; alpha: Uint8Array; warnings: string[] }
  /** `outline` is absent when no bullet is outlined; the measurement is absent then too. */
  | { kind: 'measured'; id: number; outline?: Outline; measurement?: BulletMeasurement }
  | { kind: 'error'; id: number; message: string }
