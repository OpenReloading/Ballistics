import { useLingui } from '@lingui/react'
import { Table } from '@mantine/core'
import { PageBar } from '@open-reloading/ui'
import { createFileRoute, notFound } from '@tanstack/react-router'
import { createIsomorphicFn } from '@tanstack/react-start'
import { NotFound } from '../../not-found.tsx'

type RecordData = { id: string; name: string } & Record<string, unknown>

const kinds: Record<string, string> = {
  cartridges: 'cartridges',
  bullets: 'bullets',
  powders: 'powders',
  primers: 'primers',
  cases: 'cases',
  targets: 'target-faces',
  federations: 'federations',
  disciplines: 'disciplines',
}

// the prerender reads the data files from disk, the browser fetches them from this edition's api/
const readRecord = createIsomorphicFn()
  .server(async (file: string): Promise<RecordData | undefined> => {
    const { readFile } = await import('node:fs/promises')
    try {
      return JSON.parse(await readFile(`public/api/${file}.json`, 'utf8'))
    } catch {
      return undefined
    }
  })
  .client(async (file: string): Promise<RecordData | undefined> => {
    const r = await fetch(`${import.meta.env.BASE_URL}api/${file}.json`)
    return r.ok ? r.json() : undefined
  })

const site = import.meta.env.VITE_SITE_URL ?? 'https://openreloading.github.io'

export const Route = createFileRoute('/$kind/$id')({
  loader: async ({ params }) => {
    const dir = kinds[params.kind]
    const record = dir && (await readRecord(`${dir}/${params.id}`))
    if (!record) throw notFound()
    return record
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) return {}
    const url = `${site}${import.meta.env.BASE_URL}${params.kind}/${params.id}/`
    const description = `${loaderData.name}: catalog record (${params.kind}). Results are simulations, not load data.`
    return {
      meta: [
        { title: `${loaderData.name} | Ballistics` },
        { name: 'description', content: description },
        { property: 'og:title', content: loaderData.name },
        { property: 'og:description', content: description },
        { property: 'og:type', content: 'website' },
        { property: 'og:url', content: url },
        { name: 'twitter:card', content: 'summary' },
      ],
      links: [{ rel: 'canonical', href: url }],
    }
  },
  component: RecordPage,
  notFoundComponent: NotFound,
})

function RecordPage() {
  const { i18n } = useLingui()
  const record = Route.useLoaderData()
  const { kind } = Route.useParams()
  const rows = Object.entries(record).filter(
    ([, v]) => typeof v === 'string' || typeof v === 'number',
  )
  return (
    <>
      <PageBar title={record.name} status={i18n._({ id: `record.${kind}`, message: kind })} />
      <Table>
        <Table.Tbody>
          {rows.map(([k, v]) => (
            <Table.Tr key={k}>
              <Table.Th>{k}</Table.Th>
              <Table.Td>{String(v)}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </>
  )
}
