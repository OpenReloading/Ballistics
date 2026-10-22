import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { safety } from '../src/lib/safety.ts'

it('holds the Safety section of README.md, line for line', () => {
  const readme = readFileSync(new URL('../../../README.md', import.meta.url), 'utf8')
  const section = readme.split('## Safety')[1].split('\n## ')[0]
  const lines = section
    .split('\n')
    .map((l) =>
      l
        .replace(/^- /, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .trim(),
    )
    .filter((l) => l !== '')
  expect(lines).toEqual([safety.intro, ...safety.items, safety.outro])
})
