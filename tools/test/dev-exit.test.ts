import { spawn } from 'node:child_process'
import { expect, it, vi } from 'vitest'
import { devExit, stopOnSignal } from '../src/dev-exit.ts'

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

it('marks a signal before the server started as stopped and signals no group', () => {
  const kill = vi.fn()
  const { stopped, dispose } = stopOnSignal(() => undefined, kill)
  try {
    expect(stopped()).toBe(false)
    process.emit('SIGINT')
    expect(stopped()).toBe(true)
    expect(kill).not.toHaveBeenCalled()
  } finally {
    dispose()
  }
})

it('passes a signal on to the process group once the server started', () => {
  const kill = vi.fn()
  const { dispose } = stopOnSignal(() => 4242, kill)
  try {
    process.emit('SIGTERM')
    expect(kill).toHaveBeenCalledWith(-4242, 'SIGTERM')
  } finally {
    dispose()
  }
})

it('removes its handlers on dispose', () => {
  const before = process.listenerCount('SIGINT')
  stopOnSignal(() => undefined).dispose()
  expect(process.listenerCount('SIGINT')).toBe(before)
})
