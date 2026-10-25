/**
 * The compute code of `POST /interior` and `POST /interior/charge-target` without Fastify, the
 * database or Node APIs: the web app's Pages edition runs it in the browser
 * (`@open-reloading/api/compute`).
 */
export { errorAnswer, notice } from './answer.ts'
export { type ChargeContext, runChargeTarget } from './charge-run.ts'
export { chargeBody } from './charge-schema.ts'
export { type InteriorContext, runInterior } from './interior-run.ts'
export { interiorBody } from './interior-schema.ts'
export type { CartridgeWithSpecs } from './limits.ts'
export {
  type ComputeRunner,
  ComputeTimeout,
  reviveError,
  runTask,
  type SerializedError,
  serializeError,
  type Task,
  taskTimeoutMs,
} from './tasks.ts'
