// One Pages artifact in SITE (default site/): stable at the root, next under /next/; EDITIONS picks a subset
import { execFileSync } from 'node:child_process'
import { mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs'

const site = process.env.SITE ?? 'site'
const editions = (process.env.EDITIONS ?? 'stable,next').split(',')
const started = performance.now()
rmSync(site, { recursive: true, force: true })
mkdirSync(site, { recursive: true })
mkdirSync('generated', { recursive: true })
for (const edition of editions) {
  const t = performance.now()
  rmSync('dist', { recursive: true, force: true })
  const env = { ...process.env, VITE_EDITION: edition }
  execFileSync('pnpm', ['exec', 'vite', 'build'], { stdio: 'inherit', env })
  // in place: the built worker overwrites the stand-in public/sw.js in dist/client
  execFileSync(
    'node',
    ['scripts/inject-precache.ts', 'dist/client', `generated/precache-${site}-${edition}.json`],
    { stdio: 'inherit', env },
  )
  // a move, not a copy: a recursive cpSync into the dev container's bind mount fails with EACCES on macOS
  renameSync('dist/client', edition === 'next' ? `${site}/next` : site)
  console.log(`${edition}: ${((performance.now() - t) / 1000).toFixed(1)} s`)
}
// Pages answers any missing path, also under /next/, with the root 404.html (measured): it writes that edition's shell
writeFileSync(
  `${site}/404.html`,
  `<!doctype html><meta charset="utf-8"><meta name="color-scheme" content="light dark"><title>Ballistics</title><script>fetch(location.pathname.startsWith('/next/')?'/next/_shell.html':'/_shell.html').then(function(r){return r.text()}).then(function(t){document.open();document.write(t);document.close()})</script>`,
)
console.log(`total: ${((performance.now() - started) / 1000).toFixed(1)} s`)
