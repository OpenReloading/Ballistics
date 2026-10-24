'use client'

import { Text } from '@mantine/core'
import type { LengthUnit } from '@open-reloading/drawing'
import { type BulletProfile, recordProfile } from '@open-reloading/drawing/bullet'
import { WarningCircle } from '@phosphor-icons/react'
import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { fetchRecord } from '../lib/api-fetch.ts'
import type { BulletRecord } from '../lib/api-types.ts'
import { sharedScale } from '../lib/bullet-compare.ts'
import { compareHref, maxComparedBullets, parseCompareIds } from '../lib/compare-ids.ts'
import {
  fetchManufacturerNames,
  type ManufacturerNames,
  productLabel,
  withManufacturerName,
} from '../lib/manufacturers.ts'
import { controlSize } from '../lib/theme.ts'
import { BulletCompare } from './bullet-compare.tsx'
import { description } from './bullet-drawing.tsx'
import { ByLengthUnit } from './by-length-unit.tsx'
import { PageBar } from './page-bar.tsx'
import { LinkButton, RecordActions } from './record-actions.tsx'
import { DataError, EmptyNote, Loading } from './states.tsx'
import { TechnicalDrawing } from './technical-drawing.tsx'

/** The compare view cannot show these ids: what is wrong and the way back to the list. */
function Problem({ title, text, rest }: { title: string; text: string; rest?: string[] }) {
  return (
    <EmptyNote
      icon={<WarningCircle size={24} aria-hidden="true" />}
      title={title}
      description={text}
      action={
        <>
          {rest && rest.length > 0 && (
            <LinkButton href={compareHref(rest)} size={controlSize.row.button}>
              Compare the others
            </LinkButton>
          )}
          <LinkButton href="/bullets" size={controlSize.row.button}>
            Choose bullets
          </LinkButton>
        </>
      }
    />
  )
}

/**
 * Every drawing at one text size and frame width, so at one scale, its lengths in `unit`; a reason
 * where one cannot draw.
 */
function drawings(records: (BulletRecord & { manufacturerName: string })[], unit: LengthUnit) {
  const profiles = records.map(recordProfile)
  const drawn = profiles.filter((p): p is BulletProfile => !('reason' in p))
  const { models, tallest } =
    drawn.length > 0 ? sharedScale(drawn, undefined, unit) : { models: [], tallest: 0 }
  return records.map((b, i) => {
    const p = profiles[i]
    if ('reason' in p)
      return (
        <Text component="p" inherit m={0} c="dimmed" fz="xs">
          No drawing: {p.reason}
        </Text>
      )
    const model = models[drawn.indexOf(p)]
    const id = `${b.id}-compare`
    const title = `Outline, ${productLabel(b)}`
    return (
      <>
        <TechnicalDrawing
          id={id}
          title={title}
          desc={description(p, unit)}
          model={model}
          tallest={tallest}
        />
        {/* on paper the same upright drawing at 1:1, as wide as the others */}
        <TechnicalDrawing
          id={`${id}-print`}
          title={title}
          describedBy={`${id}-desc`}
          model={model}
          printScale={1}
        />
      </>
    )
  })
}

type Fetched =
  | { status: 'loading' }
  | { status: 'unavailable' }
  | { status: 'ok'; records: (BulletRecord | undefined)[]; names: ManufacturerNames }

/** The records of `ids` (undefined where unknown) and the manufacturer names, through `apiFetch`. */
async function fetchBullets(ids: string[]): Promise<Fetched> {
  try {
    const [records, names] = await Promise.all([
      Promise.all(ids.map((id) => fetchRecord<BulletRecord>('bullets', id))),
      fetchManufacturerNames(),
    ])
    return { status: 'ok', records, names }
  } catch {
    return { status: 'unavailable' }
  }
}

/** The page bar of the compare page; the actions only where they act on bullets. */
export function CompareBar({ actions }: { actions: boolean }) {
  return <PageBar title="Compare bullets" actions={actions ? <RecordActions /> : undefined} />
}

/** The compare view of the `ids` in the URL, read in the browser so the page stays static. */
export function CompareView() {
  const ids = useSearchParams().get('ids') ?? undefined
  const parsed = parseCompareIds(ids)
  const wanted = parsed.status === 'ok' ? parsed.ids.join(',') : ''
  const [got, setGot] = useState<Fetched>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  // biome-ignore lint/correctness/useExhaustiveDependencies: Retry raises `attempt` to fetch again
  useEffect(() => {
    if (!wanted) return
    let live = true
    setGot({ status: 'loading' })
    fetchBullets(wanted.split(',')).then((r) => {
      if (live) setGot(r)
    })
    return () => {
      live = false
    }
  }, [wanted, attempt])
  const done =
    parsed.status === 'ok' && got.status === 'ok' && got.records.every((r) => r !== undefined)
  return (
    <>
      {/* Units, Copy link and Print only with bullets to show */}
      <CompareBar actions={done} />
      <CompareBody parsed={parsed} got={got} retry={() => setAttempt((n) => n + 1)} />
    </>
  )
}

/** What the compare page shows for the `ids` of its URL: the comparison, or why there is none. */
function CompareBody({
  parsed,
  got,
  retry,
}: {
  parsed: ReturnType<typeof parseCompareIds>
  got: Fetched
  retry: () => void
}) {
  if (parsed.status === 'empty')
    return (
      <Problem title="No bullets chosen." text="Tick 2 to 4 bullets in the list, then Compare." />
    )
  if (parsed.status === 'tooMany')
    return (
      <Problem
        title="Too many bullets."
        text={`The link names ${parsed.count} bullets; at most ${maxComparedBullets} compare at once.`}
      />
    )
  if (parsed.status === 'invalid')
    return (
      <Problem
        title="This link is not valid."
        text={`Not a bullet id: ${parsed.ids.map((id) => `"${id}"`).join(', ')}.`}
      />
    )
  if (got.status === 'loading') return <Loading what="bullets" />
  if (got.status === 'unavailable') return <DataError what="Bullet" retry={retry} />
  const records = withManufacturerName(
    got.records.flatMap((r) => (r ? [r] : [])),
    got.names,
  )
  const unknown = parsed.ids.filter((_, i) => got.records[i] === undefined)
  if (unknown.length > 0)
    return (
      <Problem
        title="Some bullets were not found."
        text={`No bullet with the id ${unknown.join(', ')}.`}
        rest={records.map((b) => b.id)}
      />
    )
  const inch = drawings(records, 'in')
  return (
    <BulletCompare
      bullets={records}
      drawings={drawings(records, 'mm').map((mm, i) => (
        <ByLengthUnit key={records[i].id} mm={mm} inch={inch[i]} />
      ))}
    />
  )
}
