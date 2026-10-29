import 'fake-indexeddb/auto'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const flagKey = 'user-data-folder-restoring'
let local: Map<string, string>

beforeEach(() => {
  local = new Map()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => local.get(k) ?? null,
    setItem: (k: string, v: string) => local.set(k, v),
    removeItem: (k: string) => local.delete(k),
  })
  // `restoreFolder` checks for a crashed read once per page load
  vi.resetModules()
})
afterEach(() => {
  vi.unstubAllGlobals()
})

const folder = () => import('../src/lib/workspace-folder.ts')

const picker = (pick: () => Promise<unknown>) =>
  vi.stubGlobal('window', { showDirectoryPicker: pick })

it('a closed folder picker is no choice, not a failure', async () => {
  picker(() => Promise.reject(new DOMException('The user aborted a request.', 'AbortError')))
  await expect((await folder()).chooseFolder()).resolves.toBeUndefined()
})

it('another picker error is thrown', async () => {
  picker(() => Promise.reject(new DOMException('Not allowed.', 'SecurityError')))
  await expect((await folder()).chooseFolder()).rejects.toThrow('Not allowed.')
})

it('offers the folder only where the browser has a directory picker', async () => {
  const { canPickFolder } = await folder()
  vi.stubGlobal('window', {})
  expect(canPickFolder()).toBe(false)
  picker(() => Promise.resolve({}))
  expect(canPickFolder()).toBe(true)
})

it('restores the folder picked before and clears the crash mark after the read', async () => {
  const { chooseFolder, forgetFolder, restoreFolder } = await folder()
  picker(() => Promise.resolve({ name: 'loads' }))
  await expect(chooseFolder()).resolves.toEqual({ name: 'loads' })
  await expect(restoreFolder()).resolves.toEqual({ name: 'loads' })
  expect(local.has(flagKey)).toBe(false)
  await forgetFolder()
  await expect(restoreFolder()).resolves.toBeUndefined()
})

it('forgets the folder unread when reading it crashed the page last time', async () => {
  const { chooseFolder, restoreFolder } = await folder()
  picker(() => Promise.resolve({ name: 'loads' }))
  await chooseFolder()
  local.set(flagKey, '1')
  await expect(restoreFolder()).resolves.toBe('lost')
  expect(local.has(flagKey)).toBe(false)
  // only the first read of a page load looks at the mark
  local.set(flagKey, '1')
  await expect(restoreFolder()).resolves.toBeUndefined()
})

it('reads the folder where local storage is blocked', async () => {
  const { chooseFolder, restoreFolder } = await folder()
  picker(() => Promise.resolve({ name: 'loads' }))
  await chooseFolder()
  const blocked = () => {
    throw new DOMException('Blocked.', 'SecurityError')
  }
  vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked, removeItem: blocked })
  await expect(restoreFolder()).resolves.toEqual({ name: 'loads' })
})

it('asks for write permission only when asked to, and only when not yet granted', async () => {
  const { folderAllowed } = await folder()
  const handle = (query: string, request: string) => {
    const h = {
      queryPermission: vi.fn(async () => query),
      requestPermission: vi.fn(async () => request),
    }
    return [h, h as unknown as FileSystemDirectoryHandle] as const
  }
  const [granted, g] = handle('granted', 'denied')
  expect(await folderAllowed(g, true)).toBe(true)
  expect(granted.requestPermission).not.toHaveBeenCalled()
  const [prompt, p] = handle('prompt', 'granted')
  expect(await folderAllowed(p, false)).toBe(false)
  expect(prompt.requestPermission).not.toHaveBeenCalled()
  expect(await folderAllowed(p, true)).toBe(true)
  const [, d] = handle('prompt', 'denied')
  expect(await folderAllowed(d, true)).toBe(false)
})
