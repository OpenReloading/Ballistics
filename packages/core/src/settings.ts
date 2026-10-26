/** An options bag whose entries may be `undefined`, which stands for "not given". */
export type Settings<T> = { [K in keyof T]?: T[K] | undefined }

/** `base` with the entries of `settings` that are not `undefined`; `base` itself is not changed. */
export function overlay<T extends object>(base: T, settings: Settings<T> | undefined): T {
  const out = { ...base }
  for (const key in settings) {
    const value = settings[key]
    if (value !== undefined) out[key] = value
  }
  return out
}
