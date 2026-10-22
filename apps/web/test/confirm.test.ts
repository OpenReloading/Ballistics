import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, it } from 'vitest'

const src = join(import.meta.dirname, '../src')

it('no source file asks with the browser confirm: questions use confirmDialog', () => {
  const hits = readdirSync(src, { recursive: true, encoding: 'utf8' })
    .filter((f) => /\.(ts|tsx|js)$/.test(f))
    .flatMap((f) =>
      readFileSync(join(src, f), 'utf8')
        .split('\n')
        .map((line, k) => ({ at: `${f}:${k + 1}`, line }))
        // the bare call too (`confirm(`), not `confirmDialog(` or a word ending in confirm
        .filter(({ line }) => /(^|[^\w.]|window\.)confirm\(/.test(line))
        .map(({ at }) => at),
    )
  expect(hits).toEqual([])
})
