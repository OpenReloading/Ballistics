import { recordIdRegex } from '@rangefoundry/schema'
import { notFound } from '@tanstack/react-router'
import { noManufacturerNames } from '../lib/manufacturers.ts'
import {
  type HeadSource,
  type HeadText,
  type RecordKind,
  recordHeadText,
  refId,
} from '../lib/record-metadata.ts'
import { titleTemplate } from '../lib/title-template.ts'
import { readData } from './-data.ts'
import { socialCard } from './-social-image.ts'

interface RecordData extends HeadText {
  name: string
}

export async function loadRecord(kind: RecordKind, id: string): Promise<RecordData> {
  // the id comes from the address and becomes part of a file path
  const record = recordIdRegex.test(id)
    ? ((await readData(`${kind}/${id}`)) as HeadSource | undefined)
    : undefined
  if (!record) throw notFound()
  const maker = record.manufacturer && refId(record.manufacturer)
  const manufacturer = maker
    ? ((await readData(`manufacturers/${maker}`)) as HeadSource | undefined)
    : undefined
  const names = manufacturer?.name
    ? new Map([[manufacturer.id, manufacturer.name]])
    : noManufacturerNames
  return { name: record.name ?? id, ...recordHeadText(kind, { ...record, id }, names) }
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
