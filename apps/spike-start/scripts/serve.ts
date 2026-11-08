// Serves site/ as GitHub Pages does (the root 404.html with status 404 for every missing path), on PORT.
// DELAY_MS holds the next edition's scripts that long on the server, for the S3 check without request interception.
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { serve } from '../../../tools/src/pages-serve.ts'

const root = fileURLToPath(new URL('../site/', import.meta.url))
const handle = serve(root, '')
const delay = Number(process.env.DELAY_MS ?? 0)
createServer((req, res) => {
  if (delay && /^\/next\/assets\/.*\.js$/.test(req.url ?? ''))
    setTimeout(() => handle(req, res), delay)
  else handle(req, res)
}).listen(Number(process.env.PORT ?? 3043), () => console.log('ready'))
