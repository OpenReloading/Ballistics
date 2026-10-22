import { afterEach, expect, it, vi } from 'vitest'
import { chooseFolder } from '../src/lib/workspace-folder.ts'

afterEach(() => {
  vi.unstubAllGlobals()
})

const picker = (error: Error) =>
  vi.stubGlobal('window', {
    showDirectoryPicker: () => Promise.reject(error),
  })

it('a closed folder picker is no choice, not a failure', async () => {
  picker(new DOMException('The user aborted a request.', 'AbortError'))
  await expect(chooseFolder()).resolves.toBeUndefined()
})

it('another picker error is thrown', async () => {
  picker(new DOMException('Not allowed.', 'SecurityError'))
  await expect(chooseFolder()).rejects.toThrow('Not allowed.')
})
