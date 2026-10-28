/** Worker of the powder tuning prototype: the fit and the hand-tuned curve, off the page's thread. */
import type { InteriorLoad, PowderParameter } from '@open-reloading/core'
import { handTune, type TuneRequest, tune } from './powder-tune-proto.ts'

export type ProtoMessage =
  | { id: number; kind: 'tune'; request: TuneRequest }
  | {
      id: number
      kind: 'hand'
      load: InteriorLoad
      values: Partial<Record<PowderParameter, number>>
      grams: number[]
    }

self.onmessage = (e: MessageEvent<ProtoMessage>) => {
  const m = e.data
  try {
    self.postMessage(
      m.kind === 'tune'
        ? { id: m.id, kind: 'tune', answer: tune(m.request) }
        : { id: m.id, kind: 'hand', ...handTune(m.load, m.values, m.grams) },
    )
  } catch (error) {
    self.postMessage({ id: m.id, kind: 'error', message: String(error) })
  }
}
