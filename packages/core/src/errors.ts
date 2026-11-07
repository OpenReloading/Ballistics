// the options bags of the models, shared with the exterior models of ballistics
export type { Settings } from '@open-reloading/ballistics'
// one error class for every logic package, so `instanceof InputError` holds for their errors too
export { InputError, need, nth } from '@open-reloading/statistics'

/** Whether an optional input is absent or a finite number above zero. */
export const positive = (v: number | undefined) => v === undefined || (Number.isFinite(v) && v > 0)
