import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Bundle } from '@open-reloading/catalog'

/** The bundle written by `pnpm --filter @open-reloading/catalog run build`, validated there. */
export function loadBundle(): Bundle {
  const path = fileURLToPath(import.meta.resolve('@open-reloading/catalog/bundle.json'))
  return JSON.parse(readFileSync(path, 'utf8')) as Bundle
}
