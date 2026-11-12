// Builds both editions and merges them into site/ as one Pages artifact: stable at the root, next under /next/.
import { execFileSync } from 'node:child_process'
import { rmSync, writeFileSync } from 'node:fs'

const started = performance.now()
rmSync('site', { recursive: true, force: true })
for (const edition of ['stable', 'next']) {
  const t = performance.now()
  rmSync('dist', { recursive: true, force: true })
  execFileSync('pnpm', ['exec', 'vite', 'build'], {
    stdio: 'inherit',
    env: { ...process.env, VITE_EDITION: edition },
  })
  // cp, not cpSync: Node 26's cpSync creates write-only files on the dev container's bind mount and fails (EACCES)
  execFileSync('cp', ['-R', 'dist/client', edition === 'next' ? 'site/next' : 'site'])
  console.log(`${edition}: ${((performance.now() - t) / 1000).toFixed(1)} s`)
}
// GitHub Pages answers every missing path with the root 404.html, also under /next/ (measured on the live site):
// the root one only picks the edition by path and writes that edition's shell in place, so the URL stays
writeFileSync(
  'site/404.html',
  `<!doctype html><meta charset="utf-8"><meta name="color-scheme" content="light dark"><title>Ballistics</title><script>fetch(location.pathname.startsWith('/next/')?'/next/_shell.html':'/_shell.html').then(function(r){return r.text()}).then(function(t){document.open();document.write(t);document.close()})</script>`,
)
console.log(`total: ${((performance.now() - started) / 1000).toFixed(1)} s`)
