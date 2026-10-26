/**
 * Web Worker of the bullet photo tool: keeps the grey of the working image the tool posts (nothing
 * leaves the browser), cuts the bullet out of it and outlines and measures a cut-out
 * (`apps/docs/docs/models/bullet-photo.md`), so the page stays responsive on a large photograph.
 */
import { type Gray, grayOf, segment } from './bullet-photo.ts'
import { measureOutline } from './bullet-photo-measure.ts'
import { fitOutline } from './bullet-photo-outline.ts'
import type { WorkerReply, WorkerRequest } from './bullet-photo-protocol.ts'
import { errorText } from './error-text.ts'

let gray: Gray | undefined

const post = (m: WorkerReply, transfer: Transferable[] = []) => self.postMessage(m, { transfer })

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const q = e.data
  try {
    if (q.kind === 'load') {
      gray = grayOf({ width: q.width, height: q.height, data: new Uint8ClampedArray(q.data) })
      post({ kind: 'loaded', id: q.id })
    } else if (q.kind === 'segment') {
      if (!gray) throw new Error('No photograph is loaded.')
      const s = segment(gray, q.exclude)
      post({ kind: 'segmented', id: q.id, alpha: s.alpha, warnings: s.warnings }, [s.alpha.buffer])
    } else {
      const seg = { width: q.width, height: q.height, alpha: q.alpha, warnings: [] }
      const outline = fitOutline(seg, { angle: q.angle })
      post({
        kind: 'measured',
        id: q.id,
        ...(outline && { outline, measurement: measureOutline(outline, q.scale) }),
      })
    }
  } catch (err) {
    post({ kind: 'error', id: q.id, message: errorText(err) })
  }
}
