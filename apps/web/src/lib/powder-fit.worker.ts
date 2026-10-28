/** Web Worker of the powder tuning screen: fits the strings off the page's thread, `answerPowderFit`. */
import { answerPowderFit, type PowderFitRequest } from './powder-fit.ts'

self.onmessage = (e: MessageEvent<PowderFitRequest>) =>
  answerPowderFit(e.data, (r) => self.postMessage(r))
