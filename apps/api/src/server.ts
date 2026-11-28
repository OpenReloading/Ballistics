import { buildApp } from './app.ts'
import { loadCatalogue } from './catalogue/node.ts'
import { listenOptions } from './listen.ts'
import { buildOpenApi } from './openapi.ts'

const app = buildApp({
  catalogue: loadCatalogue(),
  logger: true,
  openApi: await buildOpenApi(),
})
await app.listen(listenOptions(process.env))

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, async () => {
    await app.close()
    process.exit(0)
  })
}
