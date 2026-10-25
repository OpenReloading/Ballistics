import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'

/**
 * The absolute path of a program, looked up in the directory of the running Node (where npm
 * lives) and the system directories, never through `PATH`.
 */
export function executable(name: string): string {
  const found = [dirname(process.execPath), '/usr/local/bin', '/usr/bin', '/bin']
    .map((dir) => join(dir, name))
    .find((file) => existsSync(file))
  if (found === undefined)
    throw new Error(`${name} not found next to Node or in the system directories`)
  return found
}
