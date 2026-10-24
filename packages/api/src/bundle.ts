import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Bundle } from '@open-reloading/data'

/** The bundle written by `npm run build -w @open-reloading/data`, validated there. */
export function loadBundle(): Bundle {
  const path = fileURLToPath(import.meta.resolve('@open-reloading/data/bundle.json'))
  return JSON.parse(readFileSync(path, 'utf8')) as Bundle
}
