// Build B for S10: the next edition into site-b/next with one source file changed (the workbench title), then restores it.
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

const file = 'src/routes/workbench.tsx'
const source = readFileSync(file, 'utf8')
if (!source.includes("message: 'Load workbench'")) throw new Error(`${file}: title not found`)
writeFileSync(file, source.replace("message: 'Load workbench'", "message: 'Load workbench B'"))
try {
  execFileSync('node', ['scripts/site.ts'], {
    stdio: 'inherit',
    env: { ...process.env, SITE: 'site-b', EDITIONS: 'next' },
  })
} finally {
  writeFileSync(file, source)
}
