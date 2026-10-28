'use client'

import {
  ActionIcon,
  Group,
  NativeSelect,
  SimpleGrid,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core'
import { type Case, caseMaterials } from '@open-reloading/schema'
import { X } from '@phosphor-icons/react'
import { type Dispatch, type SetStateAction, useEffect, useRef, useState } from 'react'
import { useTranslation } from '../i18n/language.ts'
import { apiFetch } from '../lib/api-fetch.ts'
import type { CartridgeSummary, CaseSummary } from '../lib/api-types.ts'
import { caseGroupCapacitySpec, caseGroupFields } from '../lib/case-group.ts'
import { fieldSi, fieldStored } from '../lib/firearm.ts'
import { kebabValue } from '../lib/list-values.ts'
import { productLabel } from '../lib/manufacturers.ts'
import { controlSize } from '../lib/theme.ts'
import type { UnitSystem } from '../lib/units.ts'
import { SiField } from './firearm-editor.tsx'
import { RecordSearch } from './record-search.tsx'
import { useManufacturerNames } from './use-manufacturer-names.ts'

/** The case products of a catalogue cartridge, for the "Start from a product" choice. */
function useProducts(cartridge: string | undefined) {
  const [items, setItems] = useState<CaseSummary[]>([])
  useEffect(() => {
    setItems([])
    if (!cartridge?.startsWith('catalogue:')) return
    const control = new AbortController()
    const params = new URLSearchParams({
      cartridge: cartridge.slice('catalogue:'.length),
      limit: '200',
    })
    apiFetch(`cases?${params}`, { signal: control.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return (await res.json()) as { items: CaseSummary[] }
      })
      .then(
        (r) => setItems(r.items),
        // unreachable: the group is entered by hand
        () => {},
      )
    return () => control.abort()
  }, [cartridge])
  return items
}

/** The open group of cases: its cartridge, the case product it starts from, the measured values and notes. */
export function CaseEditor({
  data,
  capacity,
  system,
  nameLeft,
  setNameLeft,
  setCartridgeNames,
  cartridgeName,
  patch,
  setCapacity,
}: {
  data: Case
  /** The measured water capacity, m3, apart from the record because it is a record of its own. */
  capacity: number | undefined
  system: UnitSystem
  nameLeft: boolean
  setNameLeft: (left: boolean) => void
  setCartridgeNames: Dispatch<SetStateAction<Record<string, string>>>
  cartridgeName: (ref: string | undefined) => string | undefined
  patch: (p: Partial<Case>) => void
  setCapacity: (m3: number | undefined) => void
}) {
  const { t } = useTranslation()
  const names = useManufacturerNames()
  const products = useProducts(data.cartridge)
  // the last chosen cartridge: clearing the field does not make the next choice a first one
  const chosen = useRef(data.cartridge ?? '')
  const product = (id: string) => products.find((p) => p.id === id)
  const label = (p: CaseSummary) =>
    productLabel({ name: p.name, manufacturer: p.manufacturer }, names)
  return (
    <section aria-labelledby="library-editor" className="library-editor">
      <Group gap="md" wrap="nowrap" className="page-panel-head library-head">
        <h2 id="library-editor" className="page-panel-title record-heading">
          {data.name || t('New brass group')}
        </h2>
        {data.cartridge && (
          <Group gap={2} wrap="nowrap">
            <Text c="dimmed" size="sm" truncate="end">
              {cartridgeName(data.cartridge)}
            </Text>
            <ActionIcon
              variant="subtle"
              size={controlSize.row.icon}
              aria-label={t('Clear the cartridge')}
              onClick={() => patch({ cartridge: '', basedOn: undefined })}
            >
              <X size={14} aria-hidden="true" />
            </ActionIcon>
          </Group>
        )}
      </Group>
      <p className="note">
        {t(
          'The capacity and the other values are the ones you measured. The workbench takes the capacity as the measured case capacity of its cartridge and shows it as measured. Enter the mean of the cases you measured and how many there were.',
        )}
      </p>
      <SimpleGrid
        className="firearm-grid"
        cols={{ base: 1, sm: 2 }}
        spacing="lg"
        verticalSpacing="sm"
      >
        <TextInput
          label={t('Name')}
          required
          maxLength={200}
          description={t('For example headstamp and batch.')}
          value={data.name ?? ''}
          onChange={(e) => patch({ name: e.currentTarget.value })}
          onBlur={() => setNameLeft(true)}
          error={nameLeft && !data.name ? t('Enter a name.') : undefined}
        />
        <div className="firearm-row">
          <span className="firearm-label" aria-hidden="true">
            {t('Cartridge')}
          </span>
          <RecordSearch<CartridgeSummary>
            kind="cartridges"
            label={t('Cartridge')}
            chosen={cartridgeName(data.cartridge) ?? t('Search cartridges')}
            picked={cartridgeName(data.cartridge) !== undefined}
            describe={(c) => c.name}
            onSelect={(c) => {
              setCartridgeNames((n) => ({ ...n, [c.id]: c.name }))
              const cartridge = `catalogue:${c.id}`
              // a measured capacity belongs to its cartridge: another one starts without it
              if (chosen.current !== '' && chosen.current !== cartridge) setCapacity(undefined)
              chosen.current = cartridge
              patch({ cartridge, basedOn: undefined })
            }}
            noneText={t('No cartridge found')}
            unreachableText={t('The database is unreachable; the cartridge can be chosen later.')}
          />
        </div>
        {products.length > 0 && (
          <NativeSelect
            label={t('Start from a case product')}
            description={t('Takes its material and mass; the values you measured replace them.')}
            value={data.basedOn?.slice('catalogue:'.length) ?? ''}
            onChange={(e) => {
              const p = product(e.currentTarget.value)
              patch(
                p
                  ? {
                      basedOn: `catalogue:${p.id}`,
                      manufacturer: `catalogue:${p.manufacturer}`,
                      material: p.material,
                      ...(p.mass !== undefined && { mass: { value: p.mass } }),
                    }
                  : { basedOn: undefined },
              )
            }}
            data={[
              { value: '', label: t('None') },
              ...products.map((p) => ({ value: p.id, label: label(p) })),
            ]}
          />
        )}
        <NativeSelect
          label={t('Material')}
          value={data.material}
          onChange={(e) => patch({ material: e.currentTarget.value as Case['material'] })}
          data={caseMaterials.options.map((value) => ({ value, label: kebabValue(t, value) }))}
        />
        <TextInput
          label={t('Headstamp')}
          maxLength={200}
          value={data.headstamp ?? ''}
          onChange={(e) => patch({ headstamp: e.currentTarget.value || undefined })}
        />
        <SiField
          spec={caseGroupCapacitySpec}
          system={system}
          si={capacity}
          onChange={setCapacity}
        />
        {caseGroupFields.map((spec) => (
          <SiField
            key={spec.key}
            spec={spec}
            system={system}
            si={fieldSi(spec, data[spec.key])}
            onChange={(si) => patch({ [spec.key]: fieldStored(spec, si) })}
          />
        ))}
        <Textarea
          className="wide"
          label={t('Notes')}
          description={t('How the cases were measured: fired or sized, primed or not.')}
          autosize
          minRows={1}
          maxRows={4}
          maxLength={10000}
          value={data.note ?? ''}
          onChange={(e) => patch({ note: e.currentTarget.value || undefined })}
        />
      </SimpleGrid>
    </section>
  )
}
