/**
 * Serves `pages/` (written by `pages.ts`) as a static host does, under `PAGES_BASE_PATH`, on
 * `PORT` (default 3003): a directory answers its `index.html`, a missing file the site's
 * `404.html` with status 404. For local review and the e2e project `pages`.
 */
import { createReadStream, statSync } from 'node:fs'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const base = process.env.PAGES_BASE_PATH ?? ''
const port = Number(process.env.PORT ?? 3003)
const root = fileURLToPath(new URL('../../pages/', import.meta.url))
const types: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
}

/**
 * The file or directory for a URL path under `base` in `root` (a path ending in its separator),
 * undefined outside them, for a malformed escape or when there is none.
 */
export function find(urlPath: string, root: string, base: string) {
  if (urlPath !== base && !urlPath.startsWith(`${base}/`)) return
  let rest: string
  try {
    rest = decodeURIComponent(urlPath.slice(base.length))
  } catch {
    return
  }
  // statSync throws on a NUL byte
  if (rest.includes('\0')) return
  const file = path.join(root, rest)
  if (!`${file}${path.sep}`.startsWith(root)) return
  const stat = statOf(file)
  if (stat?.isFile()) return { file }
  if (stat?.isDirectory() && statOf(path.join(file, 'index.html')))
    return { file: path.join(file, 'index.html'), directory: true }
  return
}

/** The stat of `file`, undefined where there is none (also below a file: ENOTDIR). */
function statOf(file: string) {
  try {
    return statSync(file, { throwIfNoEntry: false })
  } catch {
    return
  }
}

/**
 * The request handler for `root` under `base`: 400 for a request target that is no path, the file,
 * else `404.html` with status 404, 500 where a found file cannot be read.
 */
export const serve =
  (root: string, base: string) => (req: IncomingMessage, res: ServerResponse) => {
    const url = URL.parse(req.url ?? '/', 'http://localhost')
    if (!url) {
      res.writeHead(400)
      return res.end()
    }
    const { pathname } = url
    const found = find(pathname, root, base)
    // a directory without its slash moves to it, as GitHub Pages does
    if (found?.directory && !pathname.endsWith('/')) {
      res.writeHead(301, { location: `${pathname}/${url.search}` })
      return res.end()
    }
    const file = found?.file
    const sent = file ?? path.join(root, '404.html')
    const stream = createReadStream(sent)
    stream.on('open', () => {
      res.writeHead(file ? 200 : 404, {
        'content-type': types[path.extname(sent)] ?? 'application/octet-stream',
      })
      stream.pipe(res)
    })
    stream.on('error', () => {
      if (res.headersSent) res.destroy()
      else res.writeHead(file ? 500 : 404).end()
    })
  }

if (import.meta.main)
  createServer(serve(root, base)).listen(port, () =>
    console.log(`pages/ on http://localhost:${port}${base}/`),
  )
