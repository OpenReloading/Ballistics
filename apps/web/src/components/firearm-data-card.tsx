'use client'

import { Table } from '@mantine/core'
import type { Firearm, Optic } from '@openreloading/schema'
import type { FieldSpec } from '../lib/field-spec.ts'
import { clickText, firearmFields, twistText } from '../lib/firearm.ts'
import { zeroConditions } from '../lib/range-card.ts'
import { type UnitSystem, withUnit } from '../lib/units.ts'
import { opticKinds } from './firearm-editor.tsx'

const kindLabel = (k: Optic['kind']) => opticKinds.find((o) => o.value === k)?.label ?? k

/** The printed data card of the open firearm: what is entered, no interface. */
export function DataCard({
  f,
  cartridge,
  system,
  opticName,
  title = true,
}: {
  f: Firearm
  cartridge?: string
  system: UnitSystem
  opticName: (id: string) => string
  /** The name as its heading; off where the panel's head names the firearm. */
  title?: boolean
}) {
  const facts: [string, string | undefined][] = [
    ['Cartridge', cartridge],
    [
      'Manufacturer and model',
      [f.manufacturerName, f.model].filter(Boolean).join(' ') || undefined,
    ],
    ...firearmFields.map((s): [string, string | undefined] => {
      const v = f[s.key]
      if (s.key === 'twist') return [s.label, twistText(f, system)]
      if (s.key === 'roundCount') return [s.label, v === undefined ? undefined : String(v)]
      return [s.label, v === undefined ? undefined : withUnit(s.quantity, system, v)]
    }),
    ['Notes', f.notes || undefined],
  ]
  const opt = (si: number | undefined, q: FieldSpec['quantity']) =>
    si === undefined ? 'n/a' : withUnit(q, system, si)
  const magnification = (o: Optic) => {
    const m = [o.minMagnification, o.maxMagnification].filter((x) => x !== undefined)
    return m.length ? `${m.join(' to ')}x` : 'n/a'
  }
  return (
    <section className="firearm-card" aria-label="Data card">
      {title && <h2>{f.name || 'New firearm'}</h2>}
      <Table withTableBorder>
        <Table.Tbody>
          {facts
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <Table.Tr key={k}>
                <Table.Th>{k}</Table.Th>
                <Table.Td>{v}</Table.Td>
              </Table.Tr>
            ))}
        </Table.Tbody>
      </Table>
      {f.optics.length > 0 && (
        <>
          <h3>Optics</h3>
          <Table withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Optic</Table.Th>
                <Table.Th>Kind</Table.Th>
                <Table.Th>Click value</Table.Th>
                <Table.Th>Turret travel</Table.Th>
                <Table.Th>Magnification</Table.Th>
                <Table.Th>Reticle</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {f.optics.map((o) => (
                <Table.Tr key={o.id}>
                  <Table.Td>{opticName(o.id)}</Table.Td>
                  <Table.Td>{kindLabel(o.kind)}</Table.Td>
                  <Table.Td>{clickText(o, system) ?? 'n/a'}</Table.Td>
                  <Table.Td>{opt(o.travel, 'correction')}</Table.Td>
                  <Table.Td>{magnification(o)}</Table.Td>
                  <Table.Td>{o.reticle || 'n/a'}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </>
      )}
      {f.configurations.map((c, i) => (
        <div key={c.id}>
          <h3>
            {c.name || `Configuration ${i + 1}`}
            {c.id === f.active && ' (active)'}
            {c.mounted && `, mounted ${c.mounted}`}
            {c.removed && `, removed ${c.removed}`}
          </h3>
          <Table withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Optic</Table.Th>
                <Table.Th>Sight height</Table.Th>
                <Table.Th>Offset</Table.Th>
                <Table.Th>Cant</Table.Th>
                <Table.Th>Zero range</Table.Th>
                <Table.Th>Zero air</Table.Th>
                <Table.Th>Drag factor</Table.Th>
                <Table.Th>Zero notes</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {c.mounts.map((m, k) => {
                const zero = zeroConditions(m, system, m.dragFactorSource)
                const air = [
                  m.zeroTemperature === undefined
                    ? ''
                    : withUnit('temperature', system, m.zeroTemperature),
                  m.zeroPressure === undefined
                    ? ''
                    : withUnit('airPressure', system, m.zeroPressure),
                  m.zeroHumidity === undefined ? '' : withUnit('percent', system, m.zeroHumidity),
                ]
                  .filter(Boolean)
                  .join(', ')
                return (
                  // biome-ignore lint/suspicious/noArrayIndexKey: mounts have no id and keep their order
                  <Table.Tr key={k}>
                    <Table.Td>{opticName(m.optic)}</Table.Td>
                    <Table.Td>{opt(m.sightHeight, 'length')}</Table.Td>
                    <Table.Td>{opt(m.lateralOffset, 'length')}</Table.Td>
                    <Table.Td>{opt(m.cant, 'angle')}</Table.Td>
                    <Table.Td>{opt(m.zeroRange, 'range')}</Table.Td>
                    <Table.Td>{air || 'n/a'}</Table.Td>
                    <Table.Td>{zero.dragFactor ?? 'n/a'}</Table.Td>
                    <Table.Td>{m.zeroNotes || 'n/a'}</Table.Td>
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
