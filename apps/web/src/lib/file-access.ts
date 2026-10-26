/**
 * File actions on user data files: the File System Access API where the browser has it
 * (Chromium), download and file input elsewhere.
 */
import { download } from './download.ts'
import { loadFileFormats } from './load-file-formats.ts'
import { folderFileName } from './user-file-names.ts'

/** File System Access API members (https://developer.mozilla.org/en-US/docs/Web/API/File_System_API). */
export type Pickers = {
  showSaveFilePicker?: (o: object) => Promise<FileSystemFileHandle>
  showOpenFilePicker?: (o: object) => Promise<FileSystemFileHandle[]>
  showDirectoryPicker?: (o: object) => Promise<FileSystemDirectoryHandle>
}

/** The window's File System Access pickers; each is absent where the browser lacks it. */
export const pickers = () => window as unknown as Pickers

const types = [{ description: 'OpenReloading data', accept: { 'application/json': ['.json'] } }]
/** A picker the user closed without a choice. */
export const aborted = (e: unknown) => e instanceof DOMException && e.name === 'AbortError'

export async function writeHandleText(handle: FileSystemFileHandle, text: string) {
  const w = await handle.createWritable()
  await w.write(text)
  await w.close()
}

/** A picked file, its handle kept for the next Save, or a download; undefined when cancelled. */
export async function saveAs(
  text: string,
  name: string,
  startIn?: FileSystemDirectoryHandle,
): Promise<{ name: string; handle?: FileSystemFileHandle | undefined } | undefined> {
  const { showSaveFilePicker } = pickers()
  if (showSaveFilePicker) {
    try {
      const handle = await showSaveFilePicker({ suggestedName: name, types, startIn })
      await writeHandleText(handle, text)
      return { name: handle.name, handle }
    } catch (e) {
      if (aborted(e)) return undefined
      throw e
    }
  }
  download(new Blob([text], { type: 'application/json' }), name)
  return { name }
}

/** Files from the open picker or a file input; empty when cancelled. */
export async function pickFiles(
  multiple: boolean,
  startIn?: FileSystemDirectoryHandle,
): Promise<{ file: File; handle?: FileSystemFileHandle | undefined }[]> {
  const { showOpenFilePicker } = pickers()
  if (showOpenFilePicker) {
    try {
      const handles = await showOpenFilePicker({
        multiple,
        types: loadFileFormats.map(({ name, accept }) => ({ description: name, accept })),
        startIn,
      })
      return Promise.all(handles.map(async (handle) => ({ file: await handle.getFile(), handle })))
    } catch (e) {
      if (aborted(e)) return []
      throw e
    }
  }
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = loadFileFormats
      .flatMap((f) => Object.entries(f.accept).flatMap(([type, ext]) => [...ext, type]))
      .join(',')
    input.multiple = multiple
    input.onchange = () => resolve([...(input.files ?? [])].map((file) => ({ file })))
    input.oncancel = () => resolve([])
    input.click()
  })
}

/** A file's text, undefined when it does not exist. */
export async function readHandleText(handle: FileSystemFileHandle) {
  try {
    return await (await handle.getFile()).text()
  } catch (e) {
    if (e instanceof DOMException && e.name === 'NotFoundError') return
    throw e
  }
}

/**
 * Writes record `id` as `name` into the folder, or as `<stem>-2.json` and so on when another record
 * holds that name; undefined, nothing written, when `allow` refuses the file's current text.
 */
export async function saveToFolder(
  folder: FileSystemDirectoryHandle,
  name: string,
  id: string,
  text: string,
  allow: (current: string | undefined) => boolean | Promise<boolean> = () => true,
) {
  const current = async (n: string) => {
    try {
      return await readHandleText(await folder.getFileHandle(n))
    } catch (e) {
      if (e instanceof DOMException && e.name === 'NotFoundError') return
      throw e
    }
  }
  const free = await folderFileName(name, id, current)
  if (!(await allow(await current(free)))) return
  const handle = await folder.getFileHandle(free, { create: true })
  await writeHandleText(handle, text)
  return handle
}
