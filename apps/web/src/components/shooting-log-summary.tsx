'use client'

import { useLingui } from '@lingui/react'
import { Button, Group, Select, SimpleGrid, Table, Text, Title } from '@mantine/core'
import { parseRef, type ShootingLogRecord, type UserRecord } from '@rangefoundry/schema'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from '../i18n/language.ts'
import { loadEnglish, ungrouped } from '../i18n/lingui.ts'
import { fetchRecord } from '../lib/api-fetch.ts'
import { resultText } from '../lib/competition-events.ts'
import { dayText, monthText } from '../lib/dates.ts'
import { download } from '../lib/download.ts'
import {
  type SummaryNames,
  type SummaryRow,
  summaryCsv,
  summaryFileName,
  type YearSummary,
  yearSummary,
} from '../lib/shooting-log-summary.ts'
import { controlSize } from '../lib/theme.ts'
import englishMessages from '../locales/en/components/shooting-log-summary.json' with {
  type: 'json',
}
import { printAlone } from './print.ts'

loadEnglish(englishMessages)

/** A design of this browser by its record name, a catalogue cartridge as the API names it (each asked once), else the reference as stored. */
function useCartridgeNames(refs: string[], records: readonly UserRecord[]) {
  const [names, setNames] = useState<Record<string, string>>({})
  const asked = useRef(new Set<string>())
  const key = refs.join('\n')
  useEffect(() => {
    for (const ref of key.split('\n')) {
      const parsed = parseRef(ref)
      if (parsed?.scope !== 'catalogue' || asked.current.has(ref)) continue
      asked.current.add(ref)
      fetchRecord<{ name: string }>('cartridges', parsed.id)
        .then((c) => c && setNames((n) => ({ ...n, [ref]: c.name })))
        // unreachable: the id shows
        .catch(() => {})
    }
  }, [key])
  const own = useMemo(() => new Map(records.map((r) => [`user:${r.id}`, r.name])), [records])
  return (ref: string) => own.get(ref) ?? names[ref] ?? parseRef(ref)?.id ?? ref
}

/** One table of totals: name, rounds and entries per row. */
function TotalsTable({
  caption,
  rows,
  name,
}: {
  caption: string
  rows: SummaryRow[]
  name: (ref: string) => string
}) {
  const { i18n } = useLingui()
  return (
    <Table className="log-summary-table" withTableBorder>
      <caption>{caption}</caption>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>{i18n._({ id: 'logSummary.name', message: 'Name' })}</Table.Th>
          <Table.Th className="num">
            {i18n._({ id: 'logSummary.rounds', message: 'Rounds' })}
          </Table.Th>
          <Table.Th className="num">
            {i18n._({ id: 'logSummary.entries', message: 'Entries' })}
          </Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {rows.map((r) => (
          <Table.Tr key={r.ref}>
            <Table.Td>{name(r.ref)}</Table.Td>
            <Table.Td className="num">{r.rounds}</Table.Td>
            <Table.Td className="num">{r.entries}</Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  )
}

/** The summary's tables: per firearm, per cartridge, per month and the competition events of the year. */
function SummaryTables({ s, names }: { s: YearSummary; names: SummaryNames }) {
  const { t } = useTranslation()
  const { i18n } = useLingui()
  return (
    <>
      <Text size="sm">
        {i18n._({
          id: 'logSummary.yearTotals',
          message: '{year}: {entries}, {rounds}',
          values: {
            year: s.year,
            entries: i18n._(
              'logSummary.entryCount',
              { count: s.entries },
              { message: '{count, plural, one {# entry} other {# entries}}', formats: ungrouped },
            ),
            rounds: i18n._(
              'logSummary.roundCount',
              { count: s.rounds },
              { message: '{count, plural, one {# round} other {# rounds}}', formats: ungrouped },
            ),
          },
        })}
      </Text>
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg" verticalSpacing="lg" mt="sm">
        <TotalsTable
          caption={i18n._({ id: 'logSummary.roundsPerFirearm', message: 'Rounds per firearm' })}
          rows={s.firearms}
          name={names.firearm}
        />
        <div>
          <TotalsTable
            caption={i18n._({
              id: 'logSummary.roundsPerCartridge',
              message: 'Rounds per cartridge',
            })}
            rows={s.cartridges}
            name={names.cartridge}
          />
          {s.withoutLoad > 0 && (
            <Text size="xs" c="dimmed" mt={4}>
              {i18n._(
                'logSummary.unsavedLoadRounds',
                { count: s.withoutLoad },
                {
                  message:
                    '{count, plural, one {# round of entries without a saved load is under its firearm only.} other {# rounds of entries without a saved load are under their firearms only.}}',
                  formats: ungrouped,
                },
              )}
            </Text>
          )}
        </div>
        <Table className="log-summary-table" withTableBorder>
          <caption>
            {i18n._({ id: 'logSummary.rangeDaysPerMonth', message: 'Range days per month' })}
          </caption>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{i18n._({ id: 'logSummary.month', message: 'Month' })}</Table.Th>
              <Table.Th className="num">
                {i18n._({ id: 'logSummary.entries', message: 'Entries' })}
              </Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {s.months.map((n, i) => (
              // oxlint-disable-next-line react/no-array-index-key -- the twelve months of a year
              <Table.Tr key={i}>
                <Table.Td>{monthText(i)}</Table.Td>
                <Table.Td className="num">{n}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        <div>
          <Text size="sm" fw={600}>
            {i18n._({ id: 'logSummary.competitions', message: 'Competitions' })}
          </Text>
          {s.events.length === 0 ? (
            <Text size="sm" c="dimmed">
              {i18n._({
                id: 'logSummary.noCompetition',
                message: 'No competition event in this year.',
              })}
            </Text>
          ) : (
            <ul className="log-summary-events">
              {s.events.map(({ event, entries }) => (
                <li key={event.id}>
                  {[
                    dayText(event.data.date),
                    event.name,
                    resultText(event.data, t),
                    i18n._(
                      'logSummary.entryCount',
                      { count: entries.length },
                      {
                        message: '{count, plural, one {# entry} other {# entries}}',
                        formats: ungrouped,
                      },
                    ),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </li>
              ))}
            </ul>
          )}
        </div>
      </SimpleGrid>
    </>
  )
}

/** It sums the log; the firearm's round count stays the one counter. */
export function LogSummary({
  entries,
  records,
  years,
  year: asked,
  firearmName,
}: {
  entries: readonly ShootingLogRecord[]
  records: readonly UserRecord[]
  /** The years with entries, latest first. */
  years: string[]
  /** The year the log's filter names, if any. */
  year: string | null
  firearmName: (ref: string | undefined) => string
}) {
  const { i18n } = useLingui()
  // the year picked here, for the year filter it was picked under: a new filter takes the summary along again
  const [picked, setPicked] = useState<{ year: string; under: string | null }>()
  const chosen = picked?.under === asked ? picked.year : null
  const year = (chosen && years.includes(chosen) ? chosen : null) ?? asked ?? years[0]
  const s = useMemo(
    () => (year ? yearSummary(entries, records, year) : undefined),
    [entries, records, year],
  )
  const cartridge = useCartridgeNames(
    s?.cartridges.map((r) => r.ref).filter(Boolean) ?? [],
    records,
  )
  if (!s) return null
  const names: SummaryNames = {
    firearm: (ref) =>
      ref ? firearmName(ref) : i18n._({ id: 'logSummary.noFirearm', message: 'No firearm' }),
    cartridge: (ref) =>
      ref
        ? cartridge(ref)
        : i18n._({ id: 'logSummary.cartridgeUnknown', message: 'Cartridge not known' }),
  }
  // the CSV leaves a name it does not know empty, in any language
  const csvNames: SummaryNames = {
    firearm: (ref) => (ref ? firearmName(ref) : ''),
    cartridge: (ref) => (ref ? cartridge(ref) : ''),
  }
  return (
    <>
      <section aria-labelledby="log-summary" className="log-summary screen-only">
        <Group justify="space-between" align="end" gap="xs">
          <Title order={2} id="log-summary" className="page-panel-title">
            {i18n._({ id: 'logSummary.yearlySummary', message: 'Yearly summary' })}
          </Title>
          <Group gap="xs" align="end">
            <Select
              label={i18n._({ id: 'logSummary.summaryYear', message: 'Summary year' })}
              size={controlSize.row.input}
              data={years.includes(s.year) ? years : [s.year, ...years]}
              value={s.year}
              allowDeselect={false}
              onChange={(v) => v !== null && setPicked({ year: String(v), under: asked })}
            />
            <Button
              variant="default"
              size={controlSize.row.button}
              onClick={() => printAlone('log-summary')}
            >
              {i18n._({ id: 'logSummary.printSummary', message: 'Print summary' })}
            </Button>
            <Button
              variant="default"
              size={controlSize.row.button}
              onClick={() =>
                download(
                  new Blob([summaryCsv(s, csvNames)], { type: 'text/csv;charset=utf-8' }),
                  summaryFileName(s.year),
                )
              }
            >
              {i18n._({ id: 'logSummary.exportSummaryCsv', message: 'Export summary CSV' })}
            </Button>
          </Group>
        </Group>
        <SummaryTables s={s} names={names} />
      </section>
      <div className="log-summary-sheet">
        <p>
          {i18n._({
            id: 'logSummary.printTitle',
            message: 'Yearly summary of the shooting log, {year}',
            values: { year: s.year },
          })}
        </p>
        <SummaryTables s={s} names={names} />
      </div>
    </>
  )
}
