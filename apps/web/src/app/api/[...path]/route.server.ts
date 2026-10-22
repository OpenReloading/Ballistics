/**
 * Forwards the browser's API calls to API_URL, read per request: the compose API host is not
 * reachable from a browser and the API sends no CORS headers. An allowlist of read endpoints and
 * POST /interior, to the same path under `API_PREFIX`; status, body, content-type and retry-after
 * pass unchanged. No database access and no solver logic here.
 */
import { API_PREFIX } from '../../../lib/api-version.ts'

const allowed = {
  GET: /^(cartridges|bullets|powders|manufacturers|target-faces|federations|disciplines|target-mappings)(\/[a-z0-9]+(-[a-z0-9]+)*)?$/,
  POST: /^interior(\/charge-target)?$/,
}
const copied = ['content-type', 'retry-after']
/** An interior body is under 1 KiB; the cap keeps the web server from buffering large bodies. */
const maxBody = 64 * 1024

/** The body as text, or undefined once it exceeds maxBody (reading stops there). */
async function cappedText(request: Request): Promise<string | undefined> {
  if (Number(request.headers.get('content-length') ?? 0) > maxBody) return undefined
  if (!request.body) return ''
  const chunks: Uint8Array[] = []
  let size = 0
  for await (const chunk of request.body) {
    size += chunk.byteLength
    if (size > maxBody) return undefined
    chunks.push(chunk)
  }
  return Buffer.concat(chunks).toString('utf8')
}

async function forward(request: Request, segments: string[], method: 'GET' | 'POST') {
  if (!allowed[method].test(segments.join('/')))
    return Response.json({ statusCode: 404, error: 'Not Found' }, { status: 404 })
  const body = method === 'POST' ? await cappedText(request) : undefined
  if (method === 'POST' && body === undefined)
    return Response.json(
      { statusCode: 413, error: 'Payload Too Large', message: 'request body above 64 KiB' },
      { status: 413 },
    )
  const apiUrl = process.env.API_URL ?? 'http://localhost:3000'
  // each segment is escaped again, so none can change the host or add a query
  const target = `${apiUrl}${API_PREFIX}/${segments.map(encodeURIComponent).join('/')}${new URL(request.url).search}`
  try {
    const contentType = request.headers.get('content-type')
    const res = await fetch(target, {
      method,
      headers: contentType ? { 'content-type': contentType } : {},
      body,
      signal: AbortSignal.timeout(15_000),
    })
    const headers = new Headers()
    for (const name of copied) {
      const value = res.headers.get(name)
      if (value !== null) headers.set(name, value)
    }
    return new Response(res.body, { status: res.status, headers })
  } catch {
    return Response.json(
      { statusCode: 502, error: 'Bad Gateway', message: 'API unreachable' },
      { status: 502 },
    )
  }
}

/** `RouteContext<'/api/[...path]'>`, written out: the Pages edition's route types lack this route. */
type Context = { params: Promise<{ path: string[] }> }

export async function GET(request: Request, context: Context) {
  return forward(request, (await context.params).path, 'GET')
}

export async function POST(request: Request, context: Context) {
  return forward(request, (await context.params).path, 'POST')
}
