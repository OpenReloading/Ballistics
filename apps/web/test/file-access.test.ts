import { afterEach, describe, expect, it, vi } from 'vitest'
import { pickFiles, readHandleText, saveAs, saveToFolder } from '../src/lib/file-access.ts'

afterEach(() => {
  vi.unstubAllGlobals()
})

const notFound = () => new DOMException('A requested file was not found.', 'NotFoundError')
const abort = () => new DOMException('The user aborted a request.', 'AbortError')

/** A file handle over `files[name]`; a write lands in `files` on close. */
function fileHandle(files: Map<string, string>, name: string) {
  return {
    name,
    getFile: () => {
      const text = files.get(name)
      return text === undefined
        ? Promise.reject(notFound())
        : Promise.resolve(new File([text], name))
    },
    createWritable: () => {
      let text = ''
      return Promise.resolve({
        write: (t: string) => {
          text += t
          return Promise.resolve()
        },
        close: () => {
          files.set(name, text)
          return Promise.resolve()
        },
      })
    },
  } as never as FileSystemFileHandle
}

/** A directory handle over `files`; an absent name without `create` throws as the browser does. */
const folderOf = (files: Map<string, string>) =>
  ({
    getFileHandle: (name: string, o?: { create?: boolean }) =>
      !files.has(name) && !o?.create
        ? Promise.reject(notFound())
        : Promise.resolve(fileHandle(files, name)),
  }) as never as FileSystemDirectoryHandle

const id = '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f'

describe('saveToFolder', () => {
  it('writes a free name', async () => {
    const files = new Map<string, string>()
    const handle = await saveToFolder(folderOf(files), 'mine.json', id, 'text')
    expect(handle?.name).toBe('mine.json')
    expect(files.get('mine.json')).toBe('text')
  })

  it('takes the next free name over another record and overwrites nothing', async () => {
    const files = new Map([
      ['mine.json', 'other'],
      ['mine-2.json', 'other 2'],
    ])
    const handle = await saveToFolder(folderOf(files), 'mine.json', id, 'text')
    expect(handle?.name).toBe('mine-3.json')
    expect(Object.fromEntries(files)).toEqual({
      'mine.json': 'other',
      'mine-2.json': 'other 2',
      'mine-3.json': 'text',
    })
  })

  it('writes nothing when the current text is refused', async () => {
    const files = new Map<string, string>()
    const allow = vi.fn(() => false)
    expect(await saveToFolder(folderOf(files), 'mine.json', id, 'text', allow)).toBeUndefined()
    expect(allow).toHaveBeenCalledWith(undefined)
    expect(files.size).toBe(0)
  })

  it('throws a folder error other than a missing file', async () => {
    const folder = {
      getFileHandle: () => Promise.reject(new DOMException('Not allowed.', 'NotAllowedError')),
    } as never as FileSystemDirectoryHandle
    await expect(saveToFolder(folder, 'mine.json', id, 'text')).rejects.toThrow('Not allowed.')
  })
})

it('reads a missing file as undefined', async () => {
  const files = new Map([['a.json', 'text']])
  expect(await readHandleText(fileHandle(files, 'a.json'))).toBe('text')
  expect(await readHandleText(fileHandle(files, 'b.json'))).toBeUndefined()
})

describe('saveAs', () => {
  it('writes the picked file and keeps its handle', async () => {
    const files = new Map<string, string>()
    vi.stubGlobal('window', {
      showSaveFilePicker: () => Promise.resolve(fileHandle(files, 'picked.json')),
    })
    const saved = await saveAs('text', 'mine.json')
    expect(saved?.name).toBe('picked.json')
    expect(saved?.handle).toBeDefined()
    expect(files.get('picked.json')).toBe('text')
  })

  it('resolves a closed picker as a cancel', async () => {
    vi.stubGlobal('window', { showSaveFilePicker: () => Promise.reject(abort()) })
    await expect(saveAs('text', 'mine.json')).resolves.toBeUndefined()
  })

  it('throws another picker error', async () => {
    vi.stubGlobal('window', {
      showSaveFilePicker: () => Promise.reject(new DOMException('Not allowed.', 'SecurityError')),
    })
    await expect(saveAs('text', 'mine.json')).rejects.toThrow('Not allowed.')
  })
})

describe('pickFiles', () => {
  it('reads the picked files with their handles', async () => {
    const files = new Map([['a.json', 'text']])
    vi.stubGlobal('window', {
      showOpenFilePicker: () => Promise.resolve([fileHandle(files, 'a.json')]),
    })
    const [picked, ...rest] = await pickFiles(false)
    expect(rest).toEqual([])
    expect(await picked?.file.text()).toBe('text')
    expect(picked?.handle?.name).toBe('a.json')
  })

  it('resolves a closed picker as a cancel', async () => {
    vi.stubGlobal('window', { showOpenFilePicker: () => Promise.reject(abort()) })
    await expect(pickFiles(true)).resolves.toEqual([])
  })

  it('throws another picker error', async () => {
    vi.stubGlobal('window', {
      showOpenFilePicker: () => Promise.reject(new DOMException('Not allowed.', 'SecurityError')),
    })
    await expect(pickFiles(true)).rejects.toThrow('Not allowed.')
  })

  describe('without the picker, through a file input', () => {
    /** Stubs a file input that `act` answers when clicked. */
    function input(
      act: (i: { onchange?: () => void; oncancel?: () => void; files?: File[] }) => void,
    ) {
      const i: Record<string, unknown> = {}
      i.click = () => act(i)
      vi.stubGlobal('window', {})
      vi.stubGlobal('document', { createElement: () => i })
      return i
    }

    it('offers the formats and returns the chosen files', async () => {
      const file = new File(['text'], 'a.json')
      const i = input((i) => {
        i.files = [file]
        i.onchange?.()
      })
      const formats = [{ name: 'Data', accept: { 'application/json': ['.json'] } }]
      expect(await pickFiles(true, undefined, formats)).toEqual([{ file }])
      expect(i).toMatchObject({ type: 'file', accept: '.json,application/json', multiple: true })
    })

    it('resolves a cancelled input as no files', async () => {
      input((i) => i.oncancel?.())
      await expect(pickFiles(false)).resolves.toEqual([])
    })
  })
})
