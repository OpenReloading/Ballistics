import sensible from '@fastify/sensible'
import apiReference from '@scalar/fastify-api-reference'
import Fastify, {
  type FastifyError,
  type FastifyInstance,
  type FastifyServerOptions,
  type RouteOptions,
} from 'fastify'
import type { Catalogue } from './catalogue/types.ts'
import { createComputeRunner, poolDefaults } from './compute/pool.ts'
import type { ComputeRunner } from './compute/tasks.ts'
import type { OpenApiDocument } from './openapi.ts'
import { cartridgeRoutes } from './routes/cartridges.ts'
import { chargeTargetRoutes } from './routes/charge-target.ts'
import { componentRoutes } from './routes/components.ts'
import { computeRoutes } from './routes/compute.ts'
import { federationRoutes } from './routes/federations.ts'
import { API_PREFIX } from './version.ts'

/** `compute` defaults to a worker pool with `poolDefaults`, closed with the app. */
type AppOptions = FastifyServerOptions & {
  catalogue: Catalogue
  compute?: ComputeRunner | undefined
  /** Sees every route as it is registered (the contract document of `openapi.ts`). */
  onRoute?: (route: RouteOptions) => void
  /** The contract document: served with its reference viewer under `API_PREFIX` when given. */
  openApi?: OpenApiDocument
}

/**
 * Builds the Fastify app: the read routes over `catalogue`, the compute routes over `compute`, both under
 * `API_PREFIX`, with `openApi` its document (`/openapi.json`) and the Scalar viewer of it
 * (`/reference/`), and the connection-close handling while the server shuts down. Registers nothing on the network; the
 * caller listens (`server.ts`) or injects requests (tests).
 */
export function buildApp({
  catalogue,
  compute,
  onRoute,
  openApi,
  ...options
}: AppOptions): FastifyInstance {
  // a client that sends its request slower than this gets a 408 and its socket closed
  const app = Fastify({ requestTimeout: 30_000, ...options })
  if (onRoute) app.addHook('onRoute', onRoute)
  // While closing, a keep-alive connection whose response was in flight closes after that
  // response instead of staying open for keepAliveTimeout (Fastify default 72 s)
  let closing = false
  // biome-ignore lint/suspicious/useAwait: Fastify waits for a hook's promise or its done callback
  app.addHook('preClose', async () => {
    closing = true
  })
  // biome-ignore lint/suspicious/useAwait: Fastify waits for a hook's promise or its done callback
  app.addHook('onSend', async (_request, reply, payload) => {
    if (closing) reply.header('connection', 'close')
    return payload
  })
  const runner = compute ?? createComputeRunner(poolDefaults)
  if (!compute) app.addHook('onClose', () => runner.close())
  app.register(sensible)
  // the route handlers rethrow what they do not answer: a 4xx keeps Fastify's answer, anything
  // else is a 500 without the error's text (a read error carries file paths), logged with the request id
  app.setErrorHandler<FastifyError>((error, request, reply) => {
    const status = error.statusCode ?? 500
    if (status >= 400 && status < 500) throw error
    request.log.error({ err: error }, 'request failed')
    return reply.code(500).send({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'internal server error',
      requestId: request.id,
    })
  })
  app.get('/', async () => ({ root: true }))
  app.register(
    // biome-ignore lint/suspicious/useAwait: Fastify waits for a plugin's promise or its done callback
    async (v1) => {
      v1.register(cartridgeRoutes, { catalogue })
      v1.register(componentRoutes, { catalogue })
      v1.register(federationRoutes, { catalogue })
      v1.register(computeRoutes, { catalogue, compute: runner })
      v1.register(chargeTargetRoutes, { catalogue, compute: runner })
      if (!openApi) return
      v1.get('/openapi.json', async () => openApi)
      v1.register(apiReference, {
        routePrefix: '/reference',
        configuration: {
          url: '../openapi.json',
          pageTitle: 'OpenReloading API',
          // the package's own script, no fonts, chat or telemetry from other origins
          withDefaultFonts: false,
          telemetry: false,
          agent: { disabled: true },
          mcp: { disabled: true },
          showDeveloperTools: 'never',
          documentDownloadType: 'json',
        },
      })
    },
    { prefix: API_PREFIX },
  )
  return app
}
