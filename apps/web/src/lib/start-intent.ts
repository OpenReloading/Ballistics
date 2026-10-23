/** What the first-run step asked the workbench to start from; read once by the workbench. */
export type StartIntent = 'example' | 'empty'

/** Dispatched on `window` when an intent is set, for a workbench that is already open. */
export const startIntentEvent = 'workbench-start-intent'

// in memory, so it works with storage blocked; a client-side navigation keeps it
let pending: StartIntent | undefined

/** Asks the workbench, open or opened next, to start from `intent`. */
export function setStartIntent(intent: StartIntent) {
  pending = intent
  window.dispatchEvent(new Event(startIntentEvent))
}

/** The pending intent, cleared: the workbench that takes it is the one that acts. */
export function takeStartIntent(): StartIntent | undefined {
  const intent = pending
  pending = undefined
  return intent
}
