import { spawnSync } from 'node:child_process'
import { expect, it, vi } from 'vitest'
import { formatRecord } from '../src/merge-loads.ts'

vi.mock('node:child_process', () => ({ spawnSync: vi.fn() }))

it('reports a format run that did not start or ended in error', () => {
  const spawn = vi.mocked(spawnSync)
  // output beyond the buffer: no status, the error names it
  spawn.mockReturnValueOnce({
    error: new Error('spawnSync node ENOBUFS'),
    status: null,
    stdout: '',
    stderr: '',
  } as never)
  expect(() => formatRecord({})).toThrow('biome format failed: spawnSync node ENOBUFS')
  spawn.mockReturnValueOnce({ status: 1, stdout: '', stderr: 'bad input' } as never)
  expect(() => formatRecord({})).toThrow('biome format failed: bad input')
  spawn.mockReturnValueOnce({ status: 0, stdout: '{}', stderr: '' } as never)
  expect(formatRecord({})).toBe('{}\n')
})
