import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Bundle } from '@openreloading/data'

/** The bundle written by `npm run build -w @openreloading/data`, validated there. */
export function loadBundle(): Bundle {
  const path = fileURLToPath(import.meta.resolve('@openreloading/data/bundle.json'))
  return JSON.parse(readFileSync(path, 'utf8')) as Bundle
}
