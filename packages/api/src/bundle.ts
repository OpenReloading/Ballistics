import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Bundle } from '@rangefoundry/catalog'

/** The bundle written by `pnpm --filter @rangefoundry/catalog run build`, validated there. */
export function loadBundle(): Bundle {
  const path = fileURLToPath(import.meta.resolve('@rangefoundry/catalog/bundle.json'))
  return JSON.parse(readFileSync(path, 'utf8')) as Bundle
}
