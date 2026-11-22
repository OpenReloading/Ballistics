import { useLingui } from '@lingui/react'
import { recordIdRegex } from '@rangefoundry/schema'
import { PageBar } from '@rangefoundry/ui'
import { notFound, useLoaderData } from '@tanstack/react-router'
import { createIsomorphicFn } from '@tanstack/react-start'
import { noManufacturerNames } from '../lib/manufacturers.ts'
import {
  type HeadSource,
  type HeadText,
  type RecordKind,
  recordHeadText,
  refId,
} from '../lib/record-metadata.ts'
import { titleTemplate } from '../lib/title-template.ts'
import { socialCard } from './-social-image.ts'

interface RecordData extends HeadText {
  kind: RecordKind
  name: string
}

// the prerender reads this build's data files from disk, the browser fetches them from its edition's api/
const readData = createIsomorphicFn()
  .server(async (file: string): Promise<HeadSource | undefined> => {
    // oxlint-disable-next-line no-restricted-imports -- only the prerender runs this branch, Start drops it from the client
    const { readFile } = await import('node:fs/promises')
    try {
      return JSON.parse(await readFile(`public/api/${file}.json`, 'utf8'))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
      throw error
    }
  })
  .client(async (file: string): Promise<HeadSource | undefined> => {
    const response = await fetch(`${import.meta.env.BASE_URL}api/${file}.json`)
    if (response.status === 404) return undefined
    if (!response.ok) throw new Error(`Error ${response.status}.`)
    return response.json()
  })

export async function loadRecord(kind: RecordKind, id: string): Promise<RecordData> {
  // the id comes from the address and becomes part of a file path
  const record = recordIdRegex.test(id) ? await readData(`${kind}/${id}`) : undefined
  if (!record) throw notFound()
  const maker = record.manufacturer && refId(record.manufacturer)
  const manufacturer = maker ? await readData(`manufacturers/${maker}`) : undefined
  const names = manufacturer?.name
    ? new Map([[manufacturer.id, manufacturer.name]])
    : noManufacturerNames
  return { kind, name: record.name ?? id, ...recordHeadText(kind, { ...record, id }, names) }
}

export function recordHead(record: RecordData | undefined) {
  if (!record) return {}
  const { title, description } = record
  return {
    meta: [
      { title: titleTemplate.replace('%s', () => title) },
      { name: 'description', content: description },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { name: 'twitter:card', content: socialCard },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: description },
    ],
  }
}

const kindNames = {
  bullets: /*i18n*/ { id: 'record.bullets', message: 'Bullet' },
  cartridges: /*i18n*/ { id: 'record.cartridges', message: 'Cartridge' },
  cases: /*i18n*/ { id: 'record.cases', message: 'Case' },
  disciplines: /*i18n*/ { id: 'record.disciplines', message: 'Discipline' },
  federations: /*i18n*/ { id: 'record.federations', message: 'Federation' },
  powders: /*i18n*/ { id: 'record.powders', message: 'Powder' },
  primers: /*i18n*/ { id: 'record.primers', message: 'Primer' },
  'target-faces': /*i18n*/ { id: 'record.targets', message: 'Target' },
} satisfies Record<RecordKind, { id: string; message: string }>

export function RecordPage() {
  const { i18n } = useLingui()
  // only the record routes render it, and their loader returns or throws notFound
  const { kind, name } = useLoaderData({ strict: false }) as RecordData
  return <PageBar title={name} status={i18n._(kindNames[kind])} />
}
