/**
 * Web Worker of the powder tuning screen: fits the strings off the page's thread
 * (`answerPowderFit`) and runs the hand-tuned curve (`answerPowderHand`).
 */

import type { PowderFitRequest, PowderHandRequest } from './powder-fit.ts'
import { answerPowderFit, answerPowderHand } from './powder-fit-answer.ts'

self.onmessage = (e: MessageEvent<PowderFitRequest | PowderHandRequest>) => {
  const q = e.data
  if ('kind' in q) answerPowderHand(q, (r) => self.postMessage(r))
  else answerPowderFit(q, (r) => self.postMessage(r))
}
