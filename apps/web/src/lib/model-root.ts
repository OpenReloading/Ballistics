import { basePath } from '@/platform/build-env.ts'

/** The site's base path on `origin` as an absolute URL ending in `/`, which the model's relative paths resolve against. */
export const editionRoot = (base: string, origin: string) => new URL(`${base}/`, origin).href

/** The page's site root, which serves the hole model and its runtime. */
export const modelRoot = () => editionRoot(basePath, location.origin)
