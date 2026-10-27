/** The workspace folder picked for saving: its handle in the browser store and its write permission. */
import { storageName } from './edition.ts'
import { aborted, type Pickers, pickers } from './file-access.ts'
import { inStore } from './user-store.ts'

type Permission = {
  queryPermission(o: object): Promise<string>
  requestPermission(o: object): Promise<string>
}

export const canPickFolder = () => typeof pickers().showDirectoryPicker === 'function'

const storedFolder = () =>
  inStore('handles', 'readonly', (s) => s.get('folder')) as Promise<
    FileSystemDirectoryHandle | undefined
  >

/** Set while a stored folder is read; still set on the next load means that read crashed the page. */
const restoring = storageName('user-data-folder-restoring')
const flag = (set: boolean) => {
  try {
    if (set) localStorage.setItem(restoring, '1')
    else localStorage.removeItem(restoring)
  } catch {}
}
let checked = false

/**
 * The workspace folder picked before, if any, or `lost` when reading it crashed the page last time
 * (seen in headless Chromium 153 with an origin-private handle); a lost folder is forgotten unread.
 */
export async function restoreFolder(): Promise<FileSystemDirectoryHandle | 'lost' | undefined> {
  if (checked) return storedFolder()
  checked = true
  let crashed = false
  try {
    crashed = localStorage.getItem(restoring) !== null
  } catch {}
  if (crashed) {
    await forgetFolder()
    flag(false)
    return 'lost'
  }
  flag(true)
  try {
    return await storedFolder()
  } finally {
    flag(false)
  }
}

/** The folder picked and stored; undefined when the picker was closed without one. */
export async function chooseFolder() {
  let handle: FileSystemDirectoryHandle
  try {
    handle = await (pickers().showDirectoryPicker as NonNullable<Pickers['showDirectoryPicker']>)({
      id: 'openreloading',
      mode: 'readwrite',
    })
  } catch (e) {
    if (aborted(e)) return
    throw e
  }
  await inStore('handles', 'readwrite', (s) => s.put(handle, 'folder'))
  return handle
}

export const forgetFolder = () => inStore('handles', 'readwrite', (s) => s.delete('folder'))

/** Whether the folder may be written; `ask` prompts, which needs a click. */
export async function folderAllowed(handle: FileSystemDirectoryHandle, ask: boolean) {
  const h = handle as unknown as Permission
  const mode = { mode: 'readwrite' }
  if ((await h.queryPermission(mode)) === 'granted') return true
  return ask && (await h.requestPermission(mode)) === 'granted'
}
