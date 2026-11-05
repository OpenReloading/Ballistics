// one error class for every logic package, so `instanceof InputError` holds for their errors too
export { InputError, need, nth } from '@open-reloading/statistics'

/** Whether an optional input is absent or a finite number above zero. */
export const positive = (v: number | undefined) => v === undefined || (Number.isFinite(v) && v > 0)

/** An options bag whose entries may be `undefined`, which stands for "not given". */
export type Settings<T> = { [K in keyof T]?: T[K] | undefined }

/** `base` with the own entries of `settings` that are not `undefined`; `base` itself is not changed. */
export function overlay<T extends object>(base: T, settings: Settings<T> | undefined): T {
  const out = { ...base }
  for (const key in settings) {
    if (!Object.hasOwn(settings, key)) continue
    const value = settings[key]
    if (value !== undefined) out[key] = value
  }
  return out
}
