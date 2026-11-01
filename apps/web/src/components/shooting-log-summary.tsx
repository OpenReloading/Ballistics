'use client'

import { Button, Group, Select, SimpleGrid, Table, Text, Title } from '@mantine/core'
import { parseRef, type ShootingLogRecord, type UserRecord } from '@open-reloading/schema'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from '../i18n/language.ts'
import { shownLanguage } from '../i18n/shown.ts'
import { fetchRecord } from '../lib/api-fetch.ts'
import { dayText } from '../lib/dates.ts'
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
import { printAlone } from './print.ts'

/** The month `index` (0 for January) by name in the language shown. */
const monthName = (index: number) =>
  new Intl.DateTimeFormat(shownLanguage() === 'en' ? 'en-GB' : shownLanguage(), {
    month: 'long',
    timeZone: 'UTC',
  }).format(Date.UTC(2026, index, 1))

/**
 * The names of the cartridges `refs` name: a design of this browser by its record name, a catalogue
 * cartridge as the API names it (each asked once), else the reference as stored.
 */
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
  const { t } = useTranslation()
  return (
    <Table className="log-summary-table" withTableBorder>
      <caption>{caption}</caption>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>{t('Name')}</Table.Th>
          <Table.Th className="num">{t('Rounds')}</Table.Th>
          <Table.Th className="num">{t('Entries')}</Table.Th>
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

/** The summary's tables: per firearm, per cartridge, per month and the competitions of the year. */
function SummaryTables({ s, names }: { s: YearSummary; names: SummaryNames }) {
  const { t, tn } = useTranslation()
  return (
    <>
      <Text size="sm">
        {t('{year}: {entries}, {rounds}', {
          year: s.year,
          entries: tn(s.entries, '{count} entry', '{count} entries'),
          rounds: tn(s.rounds, '{count} round', '{count} rounds'),
        })}
      </Text>
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg" verticalSpacing="lg" mt="sm">
        <TotalsTable caption={t('Rounds per firearm')} rows={s.firearms} name={names.firearm} />
        <div>
          <TotalsTable
            caption={t('Rounds per cartridge')}
            rows={s.cartridges}
            name={names.cartridge}
          />
          {s.withoutLoad > 0 && (
            <Text size="xs" c="dimmed" mt={4}>
              {tn(
                s.withoutLoad,
                '{count} round of entries without a saved load is under its firearm only.',
                '{count} rounds of entries without a saved load are under their firearms only.',
              )}
            </Text>
          )}
        </div>
        <Table className="log-summary-table" withTableBorder>
          <caption>{t('Range days per month')}</caption>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t('Month')}</Table.Th>
              <Table.Th className="num">{t('Entries')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {s.months.map((n, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: the twelve months of a year
              <Table.Tr key={i}>
                <Table.Td>{monthName(i)}</Table.Td>
                <Table.Td className="num">{n}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        <div>
          <Text size="sm" fw={600}>
            {t('Competitions')}
          </Text>
          {s.events.length === 0 ? (
            <Text size="sm" c="dimmed">
              {t('No entry of this year is linked to a competition.')}
            </Text>
          ) : (
            <ul className="log-summary-events">
              {s.events.map((r) => (
                <li key={r.id}>
                  {[
                    dayText(r.data.date),
                    r.data.firearm && names.firearm(r.data.firearm),
                    tn(r.data.rounds, '{count} round', '{count} rounds'),
                    r.data.result,
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

/**
 * The yearly summary of the shooting log: per calendar year the rounds per firearm and per cartridge,
 * the entries per month and the entries linked to a competition, with its own print and CSV. It sums
 * the log; the firearm's round count stays the one counter.
 */
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
  const { t } = useTranslation()
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
    firearm: (ref) => (ref ? firearmName(ref) : t('No firearm')),
    cartridge: (ref) => (ref ? cartridge(ref) : t('Cartridge not known')),
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
            {t('Yearly summary')}
          </Title>
          <Group gap="xs" align="end">
            <Select
              label={t('Summary year')}
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
              {t('Print summary')}
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
              {t('Export summary CSV')}
            </Button>
          </Group>
        </Group>
        <SummaryTables s={s} names={names} />
      </section>
      <div className="log-summary-sheet">
        <p>{t('Yearly summary of the shooting log, {year}', { year: s.year })}</p>
        <SummaryTables s={s} names={names} />
      </div>
    </>
  )
}
