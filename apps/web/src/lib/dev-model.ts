import { basePath } from '@/platform/edition.ts'

/** `localStorage` key that switches the learned detector on with the served model (`apps/docs/docs/models/hole-detection.md`, "Learned detector in the app"). */
const devModelKey = 'holeModel'

/** The edition's base path on `origin` as an absolute URL ending in `/`, which the model's relative paths resolve against. */
export const editionRoot = (base: string, origin: string) => new URL(`${base}/`, origin).href

/** The page's edition root when the key is set; absent when it is not or storage refuses. */
export function devModelRoot(): string | undefined {
  let on: string | null
  try {
    on = localStorage.getItem(devModelKey)
  } catch {
    return undefined
  }
  return on ? editionRoot(basePath, location.origin) : undefined
}
