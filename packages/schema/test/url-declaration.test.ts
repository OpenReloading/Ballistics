import { spawnSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// What the comment of src/url.d.ts relies on: its `var URL` conflicts with the DOM's and Node's instead of merging, so the file must reach no compile that has them, and the build leaves it out of the package.
const tsc = createRequire(import.meta.url)
  .resolve('typescript/package.json')
  .replace(/package\.json$/, 'bin/tsc')

/** What tsc reports on src/url.d.ts with the given options. */
const compile = (...options: string[]) =>
  spawnSync(process.execPath, [tsc, '--noEmit', '--ignoreConfig', ...options, 'src/url.d.ts'], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    encoding: 'utf8',
  }).stdout

describe('src/url.d.ts', () => {
  it('compiles on its own', () => {
    expect(compile('--lib', 'es2024')).toBe('')
  })

  it.each([
    ['the DOM', ['--lib', 'es2024,dom']],
    ['Node', ['--lib', 'es2024', '--types', 'node']],
  ])('conflicts with the URL of %s', (_, options) => {
    expect(compile(...options)).toMatch(/error TS2403: .*Variable 'URL'/)
  })

  it('is not in the built package, and no built declaration refers to it', () => {
    const dist = new URL('../dist/', import.meta.url)
    const declarations = readdirSync(dist, { recursive: true, encoding: 'utf8' }).filter((name) =>
      name.endsWith('.d.ts'),
    )
    expect(declarations).toContain('provenance.d.ts')
    expect(declarations).not.toContain('url.d.ts')
    for (const name of declarations) {
      expect(readFileSync(new URL(name, dist), 'utf8'), name).not.toContain('url.d.ts')
    }
  })
})
