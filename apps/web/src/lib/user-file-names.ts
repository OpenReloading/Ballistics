/** File names of user records, and the free name in a folder. */
import { parseUserDataFile } from './user-data.ts'

/** The name of a copy; the record name holds 200 characters at most. */
export const copyName = (name: string) => `${name.slice(0, 200 - ' copy'.length)} copy`

/** File name of a record: its name in lower case, words joined by `-`. */
export const recordFileName = (name: string) =>
  `${
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'record'
  }.json`

/** Whether a file's text holds record `id` and nothing else, so a Save may write over it. */
export function ownsFile(text: string | undefined, id: string) {
  if (text === undefined) return false
  const p = parseUserDataFile(text)
  return p.ok && p.records.length === 1 && p.records[0].id === id
}

/** The first of `name`, `<stem>-2.json`, ... that `read` finds absent or holding only record `id`. */
export async function folderFileName(
  name: string,
  id: string,
  read: (name: string) => Promise<string | undefined>,
) {
  const stem = name.replace(/\.json$/, '')
  for (let i = 1; ; i++) {
    const candidate = i === 1 ? name : `${stem}-${i}.json`
    const text = await read(candidate)
    if (text === undefined || ownsFile(text, id)) return candidate
  }
}
