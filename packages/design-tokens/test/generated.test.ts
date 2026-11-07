import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { outputs } from '../scripts/generate.ts'

it('commits what the token source generates, after the contrast lint of every context', async () => {
  for (const { filename, contents } of await outputs()) {
    expect(readFileSync(new URL(`../${filename}`, import.meta.url), 'utf8'), filename).toBe(
      contents,
    )
  }
})
