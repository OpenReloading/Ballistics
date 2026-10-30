'use client'

import { Table } from '@mantine/core'
import type { Firearm, Optic } from '@open-reloading/schema'
import { useTranslation } from '../i18n/language.ts'
import { plainNumber } from '../i18n/number.ts'
import { type Message, msg } from '../i18n/translate.ts'
import { dayText } from '../lib/dates.ts'
import type { FieldSpec } from '../lib/field-spec.ts'
import { clickText, fieldSi, firearmFields, siOf, twistText, zeroFill } from '../lib/firearm.ts'
import { zeroConditions } from '../lib/range-card.ts'
import { type UnitSystem, withUnit } from '../lib/units.ts'
import { opticKinds } from './firearm-editor.tsx'

/** The printed data card of the open firearm: what is entered, no interface. */
export function DataCard({
  f,
  cartridge,
  landsBullet,
  manufacturer,
  system,
  opticName,
  title = true,
}: {
  f: Firearm
  cartridge?: string | undefined
  /** The name of the bullet the lands contact was measured with. */
  landsBullet?: string | undefined
  /** The name of the maker, `f.manufacturer` resolved. */
  manufacturer?: string | undefined
  system: UnitSystem
  opticName: (id: string) => string
  /** The name as its heading; off where the panel's head names the firearm. */
  title?: boolean
}) {
  const { t } = useTranslation()
  const kindLabel = (k: Optic['kind']) => {
    const label = opticKinds.find((o) => o.value === k)?.label
    return label ? t(label) : k
  }
  const facts: [Message, string | undefined][] = [
    [msg('Cartridge'), cartridge],
    [msg('Manufacturer and model'), [manufacturer, f.model].filter(Boolean).join(' ') || undefined],
    ...firearmFields.map((s): [Message, string | undefined] => {
      if (s.key === 'twist') return [s.label, twistText(f, system, t)]
      if (s.key === 'roundCount' && f.roundCount !== undefined && f.roundCountDate)
        return [
          s.label,
          t('{rounds}, as of {date}', {
            rounds: plainNumber(f.roundCount),
            date: dayText(f.roundCountDate),
          }),
        ]
      if (s.key === 'roundCount' || s.key === 'noteAtRoundCount') {
        const count = f[s.key]
        return [s.label, count === undefined ? undefined : plainNumber(count)]
      }
      const si = fieldSi(s, f[s.key])
      return [s.label, si === undefined ? undefined : withUnit(s.quantity, system, si)]
    }),
    [msg('Bullet of the lands contact'), landsBullet],
    [msg('Notes'), f.notes || undefined],
  ]
  const opt = (si: number | undefined, q: FieldSpec['quantity']) =>
    si === undefined ? t('n/a') : withUnit(q, system, si)
  const magnification = (o: Optic) => {
    const m = [o.minMagnification, o.maxMagnification].filter((x) => x !== undefined)
    const [low, high] = m
    if (low === undefined) return t('n/a')
    return high === undefined
      ? t('{magnification}x', { magnification: low })
      : t('{low} to {high}x', { low, high })
  }
  return (
    <section className="firearm-card" aria-label={t('Data card')}>
      {title && <h2>{f.name || t('New firearm')}</h2>}
      <Table withTableBorder>
        <Table.Tbody>
          {facts
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <Table.Tr key={k}>
                <Table.Th>{t(k)}</Table.Th>
                <Table.Td>{v}</Table.Td>
              </Table.Tr>
            ))}
        </Table.Tbody>
      </Table>
      {f.optics.length > 0 && (
        <>
          <h3>{t('Optics')}</h3>
          <Table withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('Optic')}</Table.Th>
                <Table.Th>{t('Kind')}</Table.Th>
                <Table.Th>{t('Click value')}</Table.Th>
                <Table.Th>{t('Turret travel')}</Table.Th>
                <Table.Th>{t('Magnification')}</Table.Th>
                <Table.Th>{t('Reticle')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {f.optics.map((o) => (
                <Table.Tr key={o.id}>
                  <Table.Td>{opticName(o.id)}</Table.Td>
                  <Table.Td>{kindLabel(o.kind)}</Table.Td>
                  <Table.Td>
                    {clickText(
                      { clickValue: siOf('angle', o.clickValue), clickUnit: o.clickUnit },
                      system,
                    ) ?? t('n/a')}
                  </Table.Td>
                  <Table.Td>{opt(siOf('angle', o.travel), 'correction')}</Table.Td>
                  <Table.Td>{magnification(o)}</Table.Td>
                  <Table.Td>{o.reticle || t('n/a')}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </>
      )}
      {f.configurations.map((c, i) => (
        <div key={c.id}>
          <h3>
            {c.name || t('Configuration {n}', { n: i + 1 })}
            {c.id === f.active && ` ${t('(active)')}`}
            {c.mounted && `, ${t('mounted {date}', { date: dayText(c.mounted) })}`}
            {c.removed && `, ${t('removed {date}', { date: dayText(c.removed) })}`}
          </h3>
          <Table withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('Optic')}</Table.Th>
                <Table.Th>{t('Sight height')}</Table.Th>
                <Table.Th>{t('Offset')}</Table.Th>
                <Table.Th>{t('Cant')}</Table.Th>
                <Table.Th>{t('Zero range')}</Table.Th>
                <Table.Th>{t('Zero air')}</Table.Th>
                <Table.Th>{t('Drag factor')}</Table.Th>
                <Table.Th>{t('Zero notes')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {c.mounts.map((m, k) => {
                const si = zeroFill(m)
                const zero = zeroConditions(si, system, m.dragFactorSource, t)
                const air = [
                  si.zeroTemperature === undefined
                    ? ''
                    : withUnit('temperature', system, si.zeroTemperature),
                  si.zeroPressure === undefined
                    ? ''
                    : withUnit('airPressure', system, si.zeroPressure),
                  si.zeroHumidity === undefined ? '' : withUnit('percent', system, si.zeroHumidity),
                ]
                  .filter(Boolean)
                  .join(', ')
                return (
                  // biome-ignore lint/suspicious/noArrayIndexKey: mounts have no id and keep their order
                  <Table.Tr key={k}>
                    <Table.Td>{opticName(m.optic)}</Table.Td>
                    <Table.Td>{opt(siOf('length', m.sightHeight), 'length')}</Table.Td>
                    <Table.Td>{opt(siOf('length', m.lateralOffset), 'length')}</Table.Td>
                    <Table.Td>{opt(siOf('angle', m.cant), 'angle')}</Table.Td>
                    <Table.Td>{opt(siOf('length', m.zeroRange), 'range')}</Table.Td>
                    <Table.Td>{air || t('n/a')}</Table.Td>
                    <Table.Td>{zero.dragFactor ?? t('n/a')}</Table.Td>
                    <Table.Td>{m.zeroNotes || t('n/a')}</Table.Td>
                  </Table.Tr>
                )
              })}
            </Table.Tbody>
          </Table>
        </div>
      ))}
    </section>
  )
}
