import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

it('installs the pnpm of .github/pnpm in the dev container', () => {
  const { dependencies } = JSON.parse(readFileSync('../.github/pnpm/package.json', 'utf8')) as {
    dependencies: { pnpm: string }
  }
  expect(readFileSync('../.devcontainer/Dockerfile', 'utf8')).toContain(
    `pnpm@${dependencies.pnpm} `,
  )
})
