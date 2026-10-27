import { spawn } from 'node:child_process'
import { expect, it } from 'vitest'
import { devExit } from '../src/dev-exit.ts'

const node = (code: string) => spawn(process.execPath, ['-e', code])

it('resolves on exit code 0', async () => {
  await expect(devExit(node(''), () => false)).resolves.toBeUndefined()
})

it('rejects on a nonzero exit nobody asked for', async () => {
  await expect(devExit(node('process.exit(1)'), () => false)).rejects.toThrow('code 1')
})

it('resolves on a nonzero exit after a signal was passed on', async () => {
  await expect(devExit(node('process.exit(130)'), () => true)).resolves.toBeUndefined()
})
