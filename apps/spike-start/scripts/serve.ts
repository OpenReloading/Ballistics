// As GitHub Pages (root 404.html, status 404); DELAY_MS holds next scripts (S3); PUT /__next?dir= swaps /next/ (S10)
import { createReadStream } from 'node:fs'
import { createServer, type ServerResponse } from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { find, serve } from '../../../tools/src/pages-serve.ts'

const app = fileURLToPath(new URL('../', import.meta.url))
const root = path.join(app, 'site/')
const handle = serve(root, '')
let nextRoot = path.join(root, 'next/')
const delay = Number(process.env.DELAY_MS ?? 0)

const notFound = (res: ServerResponse) => {
  res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' })
  createReadStream(path.join(root, '404.html')).pipe(res)
}

createServer((req, res) => {
  const url = URL.parse(req.url ?? '/', 'http://localhost')
  const pathname = url?.pathname ?? '/'
  if (req.method === 'PUT' && pathname === '/__next') {
    nextRoot = `${path.resolve(app, url?.searchParams.get('dir') ?? 'site/next')}${path.sep}`
    console.log(`/next/ from ${nextRoot}`)
    return res.end()
  }
  const go = () => {
    if (pathname !== '/next' && !pathname.startsWith('/next/')) return handle(req, res)
    if (!find(pathname, nextRoot, '/next')) return notFound(res)
    serve(nextRoot, '/next')(req, res)
  }
  if (delay && /^\/next\/assets\/.*\.js$/.test(pathname)) setTimeout(go, delay)
  else go()
}).listen(Number(process.env.PORT ?? 3043), () => console.log('ready'))
