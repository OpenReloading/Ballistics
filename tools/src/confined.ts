import { isAbsolute, relative, resolve } from 'node:path'

/** The absolute path of `file` (relative to the working directory), refused outside every root. */
export function confined(file: string, roots: string[]): string {
  const target = resolve(file)
  const inside = roots.some((root) => {
    const rel = relative(resolve(root), target)
    return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel)
  })
  if (!inside) throw new Error(`${file} is outside ${roots.join(', ')}`)
  return target
}
