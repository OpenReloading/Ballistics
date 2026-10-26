'use client'

import { Alert, Badge, Button, Flex, Group, NativeSelect, Tabs } from '@mantine/core'
import type { ChronoImport, VelocityUnit } from '@open-reloading/importers'
import { toSi } from '@open-reloading/schema'
import { FileArrowUp } from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import {
  chronoFileBytes,
  exampleCsv,
  exampleSessionFileName,
  formatNames,
  readSession,
  sessionCsvBlob,
  sessionJsonBlob,
  stringName,
} from '../lib/chrono.ts'
import { localDay } from '../lib/dates.ts'
import { download } from '../lib/download.ts'
import { errorText } from '../lib/error-text.ts'
import { stringStats } from '../lib/string-stats.ts'
import { controlSize } from '../lib/theme.ts'
import { formatNumber, type UnitSystem, withUnit } from '../lib/units.ts'
import { ChronoDropZone } from './chrono-drop-zone.tsx'
import { formats, TemplateLinks } from './chrono-file-input.tsx'
import { LazyLineChart, preloadChart } from './lazy-chart.tsx'
import { PageBar } from './page-bar.tsx'
import { Panel } from './panel.tsx'
import { PrintButton } from './record-actions.tsx'
import { PanelTable } from './scroll-region.tsx'
import { EmptyNote, ErrorNote } from './states.tsx'
import { UnitsIconButton, useUnits } from './units-settings.tsx'

type Read = { fileName: string; data: ChronoImport; pick: number }

const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`

const help = `Reads ${formats}. The file is read in this browser; it is not uploaded or stored.`

/**
 * The session summary: the page bar with Units, Export JSON, Export CSV and Print, a one-row import
 * strip, then the session's badges, the statistics per string, the velocity-per-shot chart with a
 * tab per string in its panel's title row, and the shots of that string.
 */
export function SessionSummary() {
  const { system } = useUnits()
  // the unit for files that name none: the Settings unit until one is chosen here
  const [chosen, setChosen] = useState<VelocityUnit>()
  const unit = chosen ?? (system.velocity.symbol as VelocityUnit)
  const [read, setRead] = useState<Read>()
  const [error, setError] = useState('')
  // kept outside the input, which is cleared so choosing the same file again reads it again
  const file = useRef<File | undefined>(undefined)
  // a later file or unit choice wins over a read still running
  const latest = useRef(0)
  // counts the files chosen: a unit change reads the same file again and keeps the open string
  const picks = useRef(0)

  async function readFile(next: File | undefined, fallback: VelocityUnit) {
    const run = ++latest.current
    if (next !== file.current) {
      picks.current++
      setRead(undefined)
    }
    file.current = next
    const pick = picks.current
    setError('')
    if (!next) return
    try {
      const data = await readSession(await chronoFileBytes(next), next.name, fallback)
      if (run === latest.current) setRead({ fileName: next.name, data, pick })
    } catch (err) {
      if (run !== latest.current) return
      setRead(undefined)
      setError(errorText(err))
    }
  }

  useEffect(preloadChart, [])
  // a file read with the fallback unit is read again when that unit changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: only on a unit change
  useEffect(() => {
    if (file.current) void readFile(file.current, unit)
  }, [unit])

  const strings = read?.data.session.strings ?? []
  const shots = strings.reduce((n, s) => n + s.shots.length, 0)
  const v = system.velocity

  return (
    <>
      <PageBar
        title="Session summary"
        status={
          <span role="status">
            {read && `Read ${count(strings.length, 'string')}, ${count(shots, 'shot')}.`}
          </span>
        }
        actions={
          <>
            <Button
              variant="default"
              disabled={!read}
              onClick={() =>
                read &&
                download(
                  sessionJsonBlob(read.data),
                  `openreloading-session-${localDay(new Date())}.json`,
                )
              }
            >
              Export JSON
            </Button>
            <Button
              variant="default"
              disabled={!read}
              onClick={() =>
                read &&
                download(
                  sessionCsvBlob(read.data, v),
                  `openreloading-session-${localDay(new Date())}.csv`,
                )
              }
            >
              Export CSV
            </Button>
            <UnitsIconButton />
            <PrintButton />
          </>
        }
      />
      <div className="sheet">
        <Flex className="session-import" wrap="wrap" rowGap="xs" columnGap="md" align="end" my="xs">
          <ChronoDropZone
            id="chrono-file"
            label="Chronograph file"
            variant="bar"
            help={help}
            file={read?.fileName}
            onFiles={([picked]) => picked && readFile(picked, unit)}
          />
          <NativeSelect
            id="chrono-unit"
            label="Unit if the file has none"
            value={unit}
            onChange={(e) => setChosen(e.currentTarget.value as VelocityUnit)}
            data={['ft/s', 'm/s']}
          />
          <TemplateLinks />
        </Flex>
        {error && (
          <ErrorNote title="The file was not read." onRetry={() => readFile(file.current, unit)}>
            {error}
          </ErrorNote>
        )}
        {read ? (
          <SummaryView key={read.pick} read={read} system={system} />
        ) : (
          !error && (
            <EmptyNote
              icon={<FileArrowUp size={24} aria-hidden="true" />}
              title="No file read yet."
              description="Choose or drop a chronograph file, or load the example: three strings of ten made-up shots."
              action={
                <Button
                  variant="default"
                  size={controlSize.row.button}
                  onClick={() =>
                    readFile(
                      new File([exampleCsv], exampleSessionFileName, { type: 'text/csv' }),
                      unit,
                    )
                  }
                >
                  Load example
                </Button>
              }
            />
          )
        )}
      </div>
    </>
  )
}

function SummaryView({ read, system }: { read: Read; system: UnitSystem }) {
  const { session, stringLabels, warnings, velocityUnits, format: kind } = read.data
  const v = system.velocity
  const speed = (ms: number) => formatNumber(v.fromSi(ms), 1)
  const device = [session.device.kind, session.device.manufacturerName, session.device.model]
    .filter(Boolean)
    .join(', ')
  const badges = [
    `File: ${read.fileName}`,
    `Format: ${formatNames[kind]}`,
    `Date: ${session.date ?? 'not in the file'}`,
    `Device: ${device}`,
    `Unit: ${velocityUnits
      .map((u) => `${u.unit}, ${u.source === 'file' ? 'from the file' : 'named at import'}`)
      .join('; ')}`,
    ...(session.muzzleDistance
      ? [
          `Muzzle distance: ${withUnit('length', system, toSi('length', session.muzzleDistance.value))}`,
        ]
      : []),
    ...(session.note ? [`Note: ${session.note}`] : []),
  ]
  const stats = session.strings.map((s) => stringStats(s.shots))
  const [open, setOpen] = useState('0')
  return (
    <section aria-labelledby="session-result" className="session-result">
      <h2 id="session-result" className="visually-hidden">
        Session
      </h2>
      <Group gap={6} my="xs">
        {badges.map((b) => (
          <Badge key={b} variant="light" color="gray" tt="none" size="sm" maw="100%" title={b}>
            {b}
          </Badge>
        ))}
      </Group>
      {warnings.length > 0 && (
        <Alert color="yellow" variant="light" title="Import notes" my="xs">
          <ul>
            {warnings.map((w, k) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: warnings keep the importer order and may repeat
              <li key={k}>{w}</li>
            ))}
          </ul>
        </Alert>
      )}
      <div className="session-panels">
        <Panel
          id="session-strings"
          title={`Statistics per string, excluded shots left out (${v.symbol})`}
        >
          <PanelTable
            label="String statistics"
            className="session-strings"
            // the panel title says it; the table keeps it as its name
            caption={
              <span className="visually-hidden">
                Statistics per string, excluded shots left out ({v.symbol})
              </span>
            }
            columns={['String', 'Shots', 'Mean', 'SD', 'ES', 'Min', 'Max']}
          >
            {session.strings.map((s, k) => {
              const st = stats[k]
              return (
                // biome-ignore lint/suspicious/noArrayIndexKey: strings keep the file order and have no id
                <tr key={k} className={String(k) === open ? 'is-open' : undefined}>
                  <td>{stringName(stringLabels, k)}</td>
                  <td className="num">
                    {st?.excluded ? `${st.count} of ${s.shots.length}` : (st?.count ?? 0)}
                  </td>
                  <td className="num">{st ? speed(st.mean) : 'n/a'}</td>
                  <td className="num">
                    {st?.standardDeviation !== undefined ? speed(st.standardDeviation) : 'n/a'}
                  </td>
                  <td className="num">{st ? speed(st.extremeSpread) : 'n/a'}</td>
                  <td className="num">{st ? speed(st.min) : 'n/a'}</td>
                  <td className="num">{st ? speed(st.max) : 'n/a'}</td>
                </tr>
              )
            })}
          </PanelTable>
        </Panel>
        <Tabs value={open} onChange={(k) => k && setOpen(k)} className="session-tabs">
          <Panel
            id="session-velocity"
            title="Velocity per shot"
            className="session-velocity"
            controls={
              <Tabs.List>
                {session.strings.map((_, k) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: strings keep the file order and have no id
                  <Tabs.Tab key={k} value={String(k)}>
                    {stringName(stringLabels, k)}
                  </Tabs.Tab>
                ))}
              </Tabs.List>
            }
          >
            {session.strings.map((s, k) => {
              const name = stringName(stringLabels, k)
              const st = stats[k]
              const kept = s.shots.flatMap((shot, n) =>
                shot.excluded ? [] : ([[n + 1, shot]] as const),
              )
              return (
                // biome-ignore lint/suspicious/noArrayIndexKey: strings keep the file order and have no id
                <Tabs.Panel key={k} value={String(k)} className="session-string">
                  <h3 className="print-only">{name}</h3>
                  {st && (
                    <Flex
                      component="dl"
                      className="session-headline"
                      wrap="wrap"
                      rowGap="0.25rem"
                      columnGap="1.5rem"
                      m={0}
                    >
                      <div>
                        <dt>Mean</dt>
                        <dd>
                          {speed(st.mean)} {v.symbol}
                        </dd>
                      </div>
                      <div>
                        <dt>SD</dt>
                        <dd>
                          {st.standardDeviation !== undefined
                            ? `${speed(st.standardDeviation)} ${v.symbol}`
                            : 'one shot'}
                        </dd>
                      </div>
                      <div>
                        <dt>ES</dt>
                        <dd>
                          {speed(st.extremeSpread)} {v.symbol}
                        </dd>
                      </div>
                    </Flex>
                  )}
                  {st && kept.length >= 2 ? (
                    <LazyLineChart
                      x={kept.map(([n]) => n)}
                      y={kept.map(([, shot]) => v.fromSi(shot.velocity.value))}
                      xLabel="Shot"
                      yLabel={`Velocity (${v.symbol})`}
                      limits={[{ y: v.fromSi(st.mean), label: 'Mean' }]}
                      points
                      integerX
                      height={210}
                      title={`Velocity per shot, ${name}`}
                      description={`Velocity of each of the ${kept.length} shots of ${name} in ${v.symbol} over the shot number, with the mean ${speed(st.mean)} as a line; excluded shots are left out. The shots table lists every value.`}
                    />
                  ) : (
                    <p className="note">Fewer than two shots to draw.</p>
                  )}
                </Tabs.Panel>
              )
            })}
          </Panel>
          <Panel id="session-shots" title="Shots" className="session-shots-panel">
            {session.strings.map((s, k) => {
              const name = stringName(stringLabels, k)
              return (
                // the open string's shots on screen, every string's in print
                <div
                  // biome-ignore lint/suspicious/noArrayIndexKey: strings keep the file order and have no id
                  key={k}
                  className="session-shots-of"
                  data-open={String(k) === open || undefined}
                >
                  <PanelTable
                    label={`Shots of ${name}`}
                    className="session-shots"
                    caption={<>Shots of {name}</>}
                    columns={['Shot', `Velocity (${v.symbol})`, 'Cold bore', 'Excluded']}
                  >
                    {s.shots.map((shot, n) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: shots keep the file order and have no id
                      <tr key={n}>
                        <td className="num">{n + 1}</td>
                        <td className="num">{speed(shot.velocity.value)}</td>
                        <td>{shot.coldBore ? 'yes' : ''}</td>
                        <td>{shot.excluded ?? ''}</td>
                      </tr>
                    ))}
                  </PanelTable>
                </div>
              )
            })}
          </Panel>
        </Tabs>
      </div>
    </section>
  )
}
