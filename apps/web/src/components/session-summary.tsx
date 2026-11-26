'use client'

import { useLingui } from '@lingui/react'
import { Badge, Button, Flex, Group, NativeSelect, Tabs } from '@mantine/core'
import type { ChronoImport, VelocityUnit } from '@rangefoundry/importers'
import { toSi } from '@rangefoundry/schema'
import { FileUp } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import Link from '@/platform/link.tsx'
import { useTranslation } from '../i18n/language.ts'
import { ungrouped } from '../i18n/lingui.ts'
import { formatNumber } from '../i18n/number.ts'
import {
  chronoFileBytes,
  exampleCsv,
  exampleSessionFileName,
  formatNames,
  formats,
  readSession,
  sessionCsvBlob,
  sessionJsonBlob,
} from '../lib/chrono.ts'
import { chronoDiagnosticText, chronoErrorText } from '../lib/chrono-diagnostics.ts'
import { dayText, localDay } from '../lib/dates.ts'
import { download } from '../lib/download.ts'
import { stringName } from '../lib/string-name.ts'
import { type StringStats, stringStats } from '../lib/string-stats.ts'
import { controlSize } from '../lib/theme.ts'
import { type UnitSystem, withUnit } from '../lib/units.ts'
import { ChronoDropZone } from './chrono-drop-zone.tsx'
import { TemplateLinks } from './chrono-file-input.tsx'
import { LazyLineChart, preloadChart } from './lazy-chart.tsx'
import { PageBar } from './page-bar.tsx'
import { Panel } from './panel.tsx'
import { PrintButton } from './record-actions.tsx'
import { PanelTable } from './scroll-region.tsx'
import { EmptyNote, ErrorNote, Message } from './states.tsx'
import { StringComparison } from './string-comparison.tsx'
import { TourButton } from './tour-button.tsx'
import { UnitsIconButton, useUnits } from './units-settings.tsx'

type Read = { fileName: string; data: ChronoImport; pick: number }

/** The velocity-per-shot chart has a tab per string in its panel's title row. */
export function SessionSummary() {
  const { t } = useTranslation()
  const { i18n } = useLingui()
  const { system } = useUnits()
  // the unit for files that name none: the Settings unit until one is chosen here
  const [chosen, setChosen] = useState<VelocityUnit>()
  const unit = chosen ?? (system.velocity.symbol as VelocityUnit)
  const [read, setRead] = useState<Read>()
  const [error, setError] = useState<unknown>()
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
    setError(undefined)
    if (!next) return
    try {
      const data = await readSession(await chronoFileBytes(next), next.name, fallback)
      if (run === latest.current) setRead({ fileName: next.name, data, pick })
    } catch (err) {
      if (run !== latest.current) return
      setRead(undefined)
      setError(err)
    }
  }

  useEffect(preloadChart, [])
  // a file read with the fallback unit is read again when that unit changes
  useEffect(() => {
    if (file.current) void readFile(file.current, unit)
  }, [unit])

  const strings = read?.data.session.strings ?? []
  const shots = strings.reduce((n, s) => n + s.shots.length, 0)
  const v = system.velocity

  return (
    <>
      <PageBar
        title={/*i18n*/ { id: 'page.session', message: 'Session summary' }}
        translated
        status={
          <span role="status">
            {read &&
              i18n._({
                id: 'sessionSummary.read',
                message: 'Read {strings}, {shots}.',
                values: {
                  strings: i18n._(
                    'sessionSummary.stringCount',
                    { count: strings.length },
                    {
                      message: '{count, plural, one {# string} other {# strings}}',
                      formats: ungrouped,
                    },
                  ),
                  shots: i18n._(
                    'sessionSummary.shotCount',
                    { count: shots },
                    {
                      message: '{count, plural, one {# shot} other {# shots}}',
                      formats: ungrouped,
                    },
                  ),
                },
              })}
          </span>
        }
        actions={
          <>
            <Button component={Link} href="/range" variant="default">
              {i18n._({ id: 'sessionSummary.rangeMode', message: 'Range mode' })}
            </Button>
            <Button
              variant="default"
              disabled={!read}
              onClick={() =>
                read &&
                download(
                  sessionJsonBlob(read.data),
                  `rangefoundry-session-${localDay(new Date())}.json`,
                )
              }
            >
              {i18n._({ id: 'sessionSummary.exportJson', message: 'Export JSON' })}
            </Button>
            <Button
              variant="default"
              disabled={!read}
              onClick={() =>
                read &&
                download(
                  sessionCsvBlob(read.data, v),
                  `rangefoundry-session-${localDay(new Date())}.csv`,
                )
              }
            >
              {i18n._({ id: 'sessionSummary.exportCsv', message: 'Export CSV' })}
            </Button>
            <TourButton page="session" />
            <UnitsIconButton />
            <PrintButton />
          </>
        }
      />
      <div className="sheet">
        <Flex className="session-import" wrap="wrap" rowGap="xs" columnGap="md" align="end" my="xs">
          <ChronoDropZone
            id="chrono-file"
            label={i18n._({ id: 'sessionSummary.chronoFile', message: 'Chronograph file' })}
            variant="bar"
            help={i18n._({
              id: 'sessionSummary.readsFormats',
              message: 'Reads {formats} in this browser; nothing is uploaded or stored.',
              values: {
                formats,
              },
            })}
            file={read?.fileName}
            onFiles={([picked]) => picked && readFile(picked, unit)}
          />
          <NativeSelect
            id="chrono-unit"
            label={i18n._({
              id: 'sessionSummary.fallbackUnit',
              message: 'Unit if the file has none',
            })}
            value={unit}
            onChange={(e) => setChosen(e.currentTarget.value as VelocityUnit)}
            data={['ft/s', 'm/s']}
          />
          <TemplateLinks />
        </Flex>
        {error !== undefined && (
          <ErrorNote
            title={i18n._({ id: 'sessionSummary.notRead', message: 'The file was not read.' })}
            onRetry={() => readFile(file.current, unit)}
          >
            {chronoErrorText(error, t, i18n)}
          </ErrorNote>
        )}
        {read ? (
          <SummaryView key={read.pick} read={read} system={system} />
        ) : (
          error === undefined && (
            <EmptyNote
              icon={<FileUp size={24} aria-hidden="true" />}
              title={i18n._({ id: 'sessionSummary.noFile', message: 'No file read yet.' })}
              description={i18n._({
                id: 'sessionSummary.noFileHelp',
                message:
                  'Choose or drop a chronograph file, or load the example: three strings of ten made-up shots.',
              })}
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
                  {i18n._({ id: 'sessionSummary.loadExample', message: 'Load example' })}
                </Button>
              }
            />
          )
        )}
      </div>
    </>
  )
}

/** The open string's statistics, each with the shot count it rests on. */
function Headline({
  st,
  speed,
  symbol,
  level,
}: {
  st: StringStats
  speed: (ms: number) => string
  symbol: string
  level: string
}) {
  const { i18n } = useLingui()
  const interval = st.standardDeviationInterval
  return (
    <Flex
      component="dl"
      className="session-headline"
      wrap="wrap"
      rowGap="0.25rem"
      columnGap="1.5rem"
      m={0}
    >
      <div>
        <dt>
          {i18n._({
            id: 'sessionSummary.meanN',
            message: 'Mean, n = {n}',
            values: { n: st.count },
          })}
        </dt>
        <dd>
          {speed(st.mean)} {symbol}
        </dd>
      </div>
      <div>
        <dt>
          {i18n._({ id: 'sessionSummary.sdN', message: 'SD, n = {n}', values: { n: st.count } })}
        </dt>
        <dd>
          {st.standardDeviation !== undefined
            ? `${speed(st.standardDeviation)} ${symbol}`
            : i18n._({ id: 'sessionSummary.oneShot', message: 'one shot' })}
        </dd>
      </div>
      {interval && (
        <div>
          <dt>
            {i18n._({
              id: 'sessionSummary.sdIntervalN',
              message: 'SD {level}, n = {n}',
              values: { level, n: st.count },
            })}
          </dt>
          <dd>
            {i18n._({
              id: 'sessionSummary.rangeWithUnit',
              message: '{low} to {high} {unit}',
              values: {
                low: speed(interval.lower),
                high: speed(interval.upper),
                unit: symbol,
              },
            })}
          </dd>
        </div>
      )}
      <div>
        <dt>
          {i18n._({ id: 'sessionSummary.esN', message: 'ES, n = {n}', values: { n: st.count } })}
        </dt>
        <dd>
          {speed(st.extremeSpread)} {symbol}
        </dd>
      </div>
    </Flex>
  )
}

function StatsRow({
  name,
  st,
  shots,
  open,
  speed,
}: {
  name: string
  st: StringStats | undefined
  shots: number
  open: boolean
  speed: (ms: number) => string
}) {
  const { i18n } = useLingui()
  const interval = st?.standardDeviationInterval
  const na = i18n._({ id: 'sessionSummary.notAvailable', message: 'n/a' })
  return (
    <tr className={open ? 'is-open' : undefined}>
      <td>{name}</td>
      <td className="num">
        {st?.excluded
          ? i18n._({
              id: 'sessionSummary.countOfTotal',
              message: '{count} of {total}',
              values: { count: st.count, total: shots },
            })
          : (st?.count ?? 0)}
      </td>
      <td className="num">{st ? speed(st.mean) : na}</td>
      <td className="num">
        {st?.standardDeviation !== undefined ? speed(st.standardDeviation) : na}
      </td>
      <td className="num">
        {interval
          ? i18n._({
              id: 'sessionSummary.range',
              message: '{low} to {high}',
              values: { low: speed(interval.lower), high: speed(interval.upper) },
            })
          : na}
      </td>
      <td className="num">{st ? speed(st.extremeSpread) : na}</td>
      <td className="num">{st ? speed(st.min) : na}</td>
      <td className="num">{st ? speed(st.max) : na}</td>
    </tr>
  )
}

function SummaryView({ read, system }: { read: Read; system: UnitSystem }) {
  const { t, language } = useTranslation()
  const { i18n } = useLingui()
  const { session, stringLabels, warnings, velocityUnits, format: kind } = read.data
  const v = system.velocity
  const speed = (ms: number) => formatNumber(v.fromSi(ms), 1)
  const device = [session.device.kind, session.device.manufacturerName, session.device.model]
    .filter(Boolean)
    .join(', ')
  const badges = [
    i18n._({ id: 'sessionSummary.file', message: 'File: {name}', values: { name: read.fileName } }),
    i18n._({
      id: 'sessionSummary.format',
      message: 'Format: {name}',
      values: { name: formatNames[kind] },
    }),
    i18n._({
      id: 'sessionSummary.date',
      message: 'Date: {date}',
      values: {
        date: session.date
          ? dayText(session.date, language)
          : i18n._({ id: 'sessionSummary.notInFile', message: 'not in the file' }),
      },
    }),
    i18n._({ id: 'sessionSummary.device', message: 'Device: {device}', values: { device } }),
    i18n._({
      id: 'sessionSummary.unit',
      message: 'Unit: {units}',
      values: {
        units: velocityUnits
          .map((u) =>
            u.source === 'file'
              ? i18n._({
                  id: 'sessionSummary.unitFromFile',
                  message: '{unit}, from the file',
                  values: { unit: u.unit },
                })
              : i18n._({
                  id: 'sessionSummary.unitAtImport',
                  message: '{unit}, named at import',
                  values: { unit: u.unit },
                }),
          )
          .join('; '),
      },
    }),
    ...(session.muzzleDistance
      ? [
          i18n._({
            id: 'sessionSummary.muzzleDistance',
            message: 'Muzzle distance: {distance}',
            values: {
              distance: withUnit('length', system, toSi('length', session.muzzleDistance.value)),
            },
          }),
        ]
      : []),
    ...(session.note
      ? [
          i18n._({
            id: 'sessionSummary.note',
            message: 'Note: {note}',
            values: { note: session.note },
          }),
        ]
      : []),
  ]
  const stats = session.strings.map((s) => stringStats(s.shots))
  const level = `${formatNumber(100 * (stats.find(Boolean)?.confidenceLevel ?? 0.95), 0)} %`
  const [open, setOpen] = useState('0')
  return (
    <section aria-labelledby="session-result" className="session-result">
      <h2 id="session-result" className="visually-hidden">
        {i18n._({ id: 'sessionSummary.heading', message: 'Session' })}
      </h2>
      <Group gap="xs" my="xs">
        {badges.map((b) => (
          <Badge key={b} variant="light" color="gray" tt="none" size="sm" maw="100%" title={b}>
            {b}
          </Badge>
        ))}
      </Group>
      {warnings.length > 0 && (
        <Message
          severity="warning"
          title={i18n._({ id: 'sessionSummary.importNotes', message: 'Import notes' })}
        >
          <ul>
            {warnings.map((w, k) => (
              // oxlint-disable-next-line react/no-array-index-key -- warnings keep the importer order and may repeat
              <li key={k}>{chronoDiagnosticText(w, t)}</li>
            ))}
          </ul>
        </Message>
      )}
      <div className="session-panels">
        <Panel
          id="session-strings"
          title={i18n._({
            id: 'sessionSummary.statsTitle',
            message: 'Statistics per string, excluded shots left out ({unit})',
            values: { unit: v.symbol },
          })}
        >
          <PanelTable
            label={i18n._({ id: 'sessionSummary.statsLabel', message: 'String statistics' })}
            className="session-strings"
            testId="session-strings"
            // the panel title says it; the table keeps it as its name
            caption={
              <span className="visually-hidden">
                {i18n._({
                  id: 'sessionSummary.statsTitle',
                  message: 'Statistics per string, excluded shots left out ({unit})',
                  values: { unit: v.symbol },
                })}
              </span>
            }
            columns={[
              i18n._({ id: 'sessionSummary.column.string', message: 'String' }),
              i18n._({ id: 'sessionSummary.shots', message: 'Shots' }),
              i18n._({ id: 'sessionSummary.mean', message: 'Mean' }),
              i18n._({ id: 'sessionSummary.column.sd', message: 'SD' }),
              i18n._({
                id: 'sessionSummary.column.sdInterval',
                message: 'SD {level}',
                values: { level },
              }),
              i18n._({ id: 'sessionSummary.column.es', message: 'ES' }),
              i18n._({ id: 'sessionSummary.column.min', message: 'Min' }),
              i18n._({ id: 'sessionSummary.column.max', message: 'Max' }),
            ]}
          >
            {session.strings.map((s, k) => (
              <StatsRow
                // oxlint-disable-next-line react/no-array-index-key -- strings keep the file order and have no id
                key={k}
                name={stringName(stringLabels, k, t)}
                st={stats[k]}
                shots={s.shots.length}
                open={String(k) === open}
                speed={speed}
              />
            ))}
          </PanelTable>
          <StringComparison
            strings={session.strings.map((_, k) => ({
              name: stringName(stringLabels, k, t),
              stats: stats[k],
            }))}
          />
          <p className="session-strings-note">
            {i18n._({
              id: 'sessionSummary.sdIntervalNote',
              message:
                'SD {level}: the range that holds the SD of the population the string is drawn from. It assumes roughly normal velocities; a stray shot or a skewed string makes it too narrow.',
              values: { level },
            })}
          </p>
        </Panel>
        <Tabs value={open} onChange={(k) => k && setOpen(k)} className="session-tabs">
          <Panel
            id="session-velocity"
            title={i18n._({ id: 'sessionSummary.velocityTitle', message: 'Velocity per shot' })}
            className="session-velocity"
            controls={
              <Tabs.List>
                {session.strings.map((_, k) => (
                  // oxlint-disable-next-line react/no-array-index-key -- strings keep the file order and have no id
                  <Tabs.Tab key={k} value={String(k)}>
                    {stringName(stringLabels, k, t)}
                  </Tabs.Tab>
                ))}
              </Tabs.List>
            }
          >
            {session.strings.map((s, k) => {
              const name = stringName(stringLabels, k, t)
              const st = stats[k]
              const kept = s.shots.flatMap((shot, n) =>
                shot.excluded ? [] : ([[n + 1, shot]] as const),
              )
              return (
                // oxlint-disable-next-line react/no-array-index-key -- strings keep the file order and have no id
                <Tabs.Panel key={k} value={String(k)} className="session-string">
                  <h3 className="print-only">{name}</h3>
                  {st && <Headline st={st} speed={speed} symbol={v.symbol} level={level} />}
                  {st && kept.length >= 2 ? (
                    <LazyLineChart
                      x={kept.map(([n]) => n)}
                      y={kept.map(([, shot]) => v.fromSi(shot.velocity.value))}
                      xLabel={i18n._({ id: 'sessionSummary.shot', message: 'Shot' })}
                      yLabel={i18n._({
                        id: 'sessionSummary.velocity',
                        message: 'Velocity ({unit})',
                        values: { unit: v.symbol },
                      })}
                      limits={[
                        {
                          y: v.fromSi(st.mean),
                          label: i18n._({ id: 'sessionSummary.mean', message: 'Mean' }),
                        },
                      ]}
                      points
                      integerX
                      height={240}
                      title={i18n._({
                        id: 'sessionSummary.chartTitle',
                        message: 'Velocity per shot, {name}',
                        values: { name },
                      })}
                      description={i18n._({
                        id: 'sessionSummary.chartDescription',
                        message:
                          'Velocity of the {count} shots of {name} in {unit} by shot number, mean {mean} as a line, excluded shots left out. The shots table lists every value.',
                        values: { count: kept.length, name, unit: v.symbol, mean: speed(st.mean) },
                      })}
                    />
                  ) : (
                    <p className="note">
                      {i18n._({
                        id: 'sessionSummary.tooFewShots',
                        message: 'Fewer than two shots to draw.',
                      })}
                    </p>
                  )}
                </Tabs.Panel>
              )
            })}
          </Panel>
          <Panel
            id="session-shots"
            title={i18n._({ id: 'sessionSummary.shots', message: 'Shots' })}
            className="session-shots-panel"
          >
            {session.strings.map((s, k) => {
              const name = stringName(stringLabels, k, t)
              const anyExcluded = s.shots.some((shot) => shot.excluded)
              return (
                // the open string's shots on screen, every string's in print
                <div
                  // oxlint-disable-next-line react/no-array-index-key -- strings keep the file order and have no id
                  key={k}
                  className="session-shots-of"
                  data-open={String(k) === open || undefined}
                >
                  <PanelTable
                    label={i18n._({
                      id: 'sessionSummary.shotsOf',
                      message: 'Shots of {name}',
                      values: { name },
                    })}
                    className="session-shots"
                    caption={i18n._({
                      id: 'sessionSummary.shotsOf',
                      message: 'Shots of {name}',
                      values: { name },
                    })}
                    columns={[
                      i18n._({ id: 'sessionSummary.shot', message: 'Shot' }),
                      i18n._({
                        id: 'sessionSummary.velocity',
                        message: 'Velocity ({unit})',
                        values: { unit: v.symbol },
                      }),
                      i18n._({ id: 'sessionSummary.coldBore', message: 'Cold bore' }),
                      ...(anyExcluded
                        ? [i18n._({ id: 'sessionSummary.excluded', message: 'Excluded' })]
                        : []),
                    ]}
                  >
                    {s.shots.map((shot, n) => (
                      // oxlint-disable-next-line react/no-array-index-key -- shots keep the file order and have no id
                      <tr key={n}>
                        <td className="num">{n + 1}</td>
                        <td className="num">{speed(shot.velocity.value)}</td>
                        <td>
                          {shot.coldBore
                            ? i18n._({ id: 'sessionSummary.yes', message: 'yes' })
                            : ''}
                        </td>
                        {anyExcluded && (
                          <td>
                            {shot.excluded === true
                              ? i18n._({
                                  id: 'sessionSummary.excludedAtRange',
                                  message: 'excluded at the range',
                                })
                              : (shot.excluded ?? '')}
                          </td>
                        )}
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
