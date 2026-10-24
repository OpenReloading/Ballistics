import { buildApp } from './app.ts'
import { loadCatalogue } from './catalogue/node.ts'
import { buildOpenApi } from './openapi.ts'

const app = buildApp({
  catalogue: loadCatalogue(),
  logger: true,
  openApi: await buildOpenApi(),
})
await app.listen({
  host: process.env.HOST ?? '0.0.0.0',
  port: Number(process.env.PORT ?? 3000),
})

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, async () => {
    await app.close()
    process.exit(0)
  })
}
