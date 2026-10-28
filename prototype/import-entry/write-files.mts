// Writes the invented files to prototype/import-entry/files/. Run: node prototype/import-entry/write-files.mts
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { inventedFiles } from '../../apps/web/src/lib/import-entry/fixtures.ts'

const dir = join(import.meta.dirname, 'files')
mkdirSync(dir, { recursive: true })
for (const f of inventedFiles()) writeFileSync(join(dir, f.name), f.bytes)
console.log(`${inventedFiles().length} files in ${dir}`)
