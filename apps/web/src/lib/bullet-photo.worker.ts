/**
 * Web Worker of the bullet photo tool: keeps the working image the tool posts (nothing
 * leaves the browser), cuts the bullet out of it and outlines and measures a cut-out
 * (`apps/docs/docs/models/bullet-photo.md`), so the page stays responsive on a large photograph.
 */
import { segmentPhoto } from './bullet-photo-colour.ts'
import { measureOutline } from './bullet-photo-measure.ts'
import { fitOutline } from './bullet-photo-outline.ts'
import type { WorkerReply, WorkerRequest } from './bullet-photo-protocol.ts'
import { outlineHints } from './bullet-photo-quality.ts'
import { errorText } from './error-text.ts'
import type { RgbaImage } from './image.ts'

let photo: RgbaImage | undefined

const post = (m: WorkerReply, transfer: Transferable[] = []) => self.postMessage(m, { transfer })

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const q = e.data
  try {
    if (q.kind === 'load') {
      photo = { width: q.width, height: q.height, data: new Uint8ClampedArray(q.data) }
      post({ kind: 'loaded', id: q.id })
    } else if (q.kind === 'segment') {
      if (!photo) throw new Error('No photograph is loaded.')
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
      const seg = { width: q.width, height: q.height, alpha: q.alpha }
      const outline = fitOutline(seg, { angle: q.angle, edgeSpread: q.edgeSpread })
      const { hints, unusable } = outline ? outlineHints(outline) : { hints: [] }
      post({
        kind: 'measured',
        id: q.id,
        hints,
        ...(unusable && { unusable }),
        ...(outline && { outline }),
        ...(outline && !unusable && { measurement: measureOutline(outline, q.scale) }),
      })
    }
  } catch (err) {
    post({ kind: 'error', id: q.id, message: errorText(err) })
  }
}
