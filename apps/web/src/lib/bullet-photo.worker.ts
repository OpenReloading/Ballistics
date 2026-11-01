/**
 * Web Worker of the bullet photo tool: keeps the working image the tool posts (nothing
 * leaves the browser), cuts the bullet out of it and outlines and measures a cut-out
 * (`apps/docs/docs/models/bullet-photo.md`), so the page stays responsive on a large photograph.
 */
import { msg } from '../i18n/translate.ts'
import { segmentPhoto } from './bullet-photo-colour.ts'
import { measureOutline } from './bullet-photo-measure.ts'
import { fitOutline } from './bullet-photo-outline.ts'
import type { WorkerReply, WorkerRequest } from './bullet-photo-protocol.ts'
import { outlineHints } from './bullet-photo-quality.ts'
import { resolveScale, withBasis } from './bullet-photo-scale.ts'
import { errorText } from './error-text.ts'
import type { RgbaImage } from './image.ts'

let photo: RgbaImage | undefined

const post = (m: WorkerReply, transfer: Transferable[] = []) => self.postMessage(m, { transfer })

type MeasureRequest = Extract<WorkerRequest, { kind: 'measure' }>

/** Outlines a cut-out and measures it at the scale of the ruler or of the caliper sizes; the outline's px when there is no scale. */
function measure(q: MeasureRequest): WorkerReply {
  const seg = { width: q.width, height: q.height, alpha: q.alpha }
  const outline = fitOutline(seg, { angle: q.angle, edgeSpread: q.edgeSpread })
  const { hints, unusable } = outline ? outlineHints(outline) : { hints: [] }
  // at 1 px per mm the values are px, which the caliper sizes turn into a scale when there is no ruler
  const unit =
    outline && !unusable ? measureOutline(outline, { pxPerMm: 1, relUncertainty: 0 }) : undefined
  const { scale, notes, basis } = unit
    ? resolveScale(unit, q.scale, q.known ?? {})
    : { scale: q.scale, notes: [], basis: undefined }
  return {
    kind: 'measured',
    id: q.id,
    hints: [...hints, ...notes],
    ...(unusable && { unusable }),
    ...(outline && { outline }),
    ...(scale && { scale }),
    ...(outline &&
      unit && { measurement: scale ? withBasis(measureOutline(outline, scale), basis) : unit }),
  }
}

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const q = e.data
  try {
    if (q.kind === 'load') {
      photo = { width: q.width, height: q.height, data: new Uint8ClampedArray(q.data) }
      post({ kind: 'loaded', id: q.id })
    } else if (q.kind === 'segment') {
      if (!photo) throw new Error(msg('No photograph is loaded.'))
      const s = segmentPhoto(photo, q.exclude)
      post(
        {
          kind: 'segmented',
          id: q.id,
          alpha: s.alpha,
          warnings: s.warnings,
          edgeSpread: s.edgeSpread,
        },
        [s.alpha.buffer],
      )
    } else {
      post(measure(q))
    }
  } catch (err) {
    post({ kind: 'error', id: q.id, message: errorText(err) })
  }
}
