'use client'

import {
  ActionIcon,
  Button,
  Card,
  Checkbox,
  Group,
  NativeSelect,
  SegmentedControl,
  SimpleGrid,
  Table,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core'
import type {
  Firearm,
  Optic,
  OpticConfiguration,
  OpticMount,
  QuantityValue,
} from '@open-reloading/schema'
import { Plus, Trash, X } from '@phosphor-icons/react'
import { type Dispatch, type ReactElement, type SetStateAction, useState } from 'react'
import type { CartridgeSummary } from '../lib/api-types.ts'
import { close, type FieldSpec, fieldError } from '../lib/field-spec.ts'
import {
  fieldSi,
  fieldStored,
  firearmFields,
  freeId,
  mountFields,
  opticFields,
  zeroFields,
} from '../lib/firearm.ts'
import { controlSize, tipEvents } from '../lib/theme.ts'
import { roundedFieldText, type UnitSystem } from '../lib/units.ts'
import { ManufacturerInput } from './manufacturer-input.tsx'
import { NumberField } from './number-field.tsx'
import { RecordSearch } from './record-search.tsx'
import type { useManufacturers } from './use-manufacturers.ts'

export const opticKinds = [
  { value: 'scope', label: 'Scope' },
  { value: 'redDot', label: 'Red dot' },
  { value: 'ironSights', label: 'Iron sights' },
  { value: 'other', label: 'Other' },
]

/** Filled in by the user; Save checks that it is a number. */
const empty = undefined as unknown as QuantityValue

/** A field's help on hover, focus and touch; the field shows no description line. */
function Tip({ help, children }: { help?: string | undefined; children: ReactElement }) {
  if (!help) return children
  return (
    <Tooltip label={help} events={tipEvents} multiline maw={280} position="top-start">
      <div>{children}</div>
    </Tooltip>
  )
}

/** A number field over an SI value; keeps the typed text until the value or the unit changes from outside. */
export function SiField({
  spec,
  system,
  si,
  onChange,
  error,
}: {
  spec: FieldSpec
  system: UnitSystem
  si: number | undefined
  onChange: (si: number | undefined) => void
  /** A cross-field error of the schema, shown when the field itself is valid. */
  error?: string | undefined
}) {
  const shown = (x: number | undefined) => ({
    text: x === undefined ? '' : roundedFieldText(spec.quantity, system, x),
    si: x,
  })
  const [state, setState] = useState({ value: shown(si), system })
  /** Left once: a field's own error shows from then on, not on a field just added. */
  const [left, setLeft] = useState(false)
  let { value } = state
  // the stored value comes back through a unit round trip: equal within its noise
  if (
    state.system !== system ||
    (value.si !== si && !(value.si !== undefined && close(value.si, si)))
  ) {
    value = shown(si)
    setState({ value, system })
  }
  return (
    <Tip help={spec.help}>
      <NumberField
        spec={spec}
        system={system}
        value={value}
        error={(s) => (left ? fieldError(spec, value, s) : undefined) ?? error}
        onBlur={() => setLeft(true)}
        onChange={(v) => {
          setState({ value: v, system })
          onChange(v.si)
        }}
      />
    </Tip>
  )
}

/** The open firearm's editor in the tabs Firearm, Optics and Configurations. */
export function FirearmEditor({
  data,
  system,
  nameLeft,
  setNameLeft,
  setCartridgeNames,
  cartridgeName,
  manufacturers,
  patch,
  setOptic,
  setConfig,
  setMount,
  crossError,
  opticName,
  mounted,
}: {
  data: Firearm
  system: UnitSystem
  nameLeft: boolean
  setNameLeft: (left: boolean) => void
  setCartridgeNames: Dispatch<SetStateAction<Record<string, string>>>
  cartridgeName: (ref: string | undefined) => string | undefined
  manufacturers: ReturnType<typeof useManufacturers>
  patch: (p: Partial<Firearm>) => void
  setOptic: (i: number, p: Partial<Optic>) => void
  setConfig: (i: number, p: Partial<OpticConfiguration>) => void
  setMount: (i: number, k: number, p: Partial<OpticMount>) => void
  crossError: (...path: (string | number)[]) => string | undefined
  opticName: (id: string) => string
  mounted: (id: string) => boolean
}) {
  return (
    <section aria-labelledby="library-editor" className="library-editor">
      <Group gap="md" wrap="nowrap" className="page-panel-head library-head">
        <h2 id="library-editor" className="page-panel-title record-heading">
          {data.name || 'New firearm'}
        </h2>
        {data.cartridge && (
          <Group gap={2} wrap="nowrap">
            <Text c="dimmed" size="sm" truncate="end">
              {cartridgeName(data.cartridge)}
            </Text>
            <ActionIcon
              variant="subtle"
              size={controlSize.row.icon}
              aria-label="Clear the cartridge"
              onClick={() => patch({ cartridge: undefined })}
            >
              <X size={14} aria-hidden="true" />
            </ActionIcon>
          </Group>
        )}
        {data.roundCount !== undefined && (
          <Text c="dimmed" size="sm">
            {data.roundCount} rounds
          </Text>
        )}
      </Group>
      <Tabs defaultValue="firearm">
        <Tabs.List mb="sm">
          <Tabs.Tab value="firearm">Firearm</Tabs.Tab>
          <Tabs.Tab value="optics">Optics ({data.optics.length})</Tabs.Tab>
          <Tabs.Tab value="configurations">Configurations ({data.configurations.length})</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="firearm">
          <SimpleGrid
            className="firearm-grid"
            cols={{ base: 1, sm: 2 }}
            spacing="lg"
            verticalSpacing="sm"
          >
            <TextInput
              label="Name"
              required
              maxLength={200}
              value={data.name}
              onChange={(e) => patch({ name: e.currentTarget.value })}
              onBlur={() => setNameLeft(true)}
              error={nameLeft && !data.name ? 'Enter a name.' : undefined}
            />
            <div className="firearm-row">
              <span className="firearm-label" aria-hidden="true">
                Cartridge
              </span>
              <RecordSearch<CartridgeSummary>
                kind="cartridges"
                label="Cartridge"
                chosen={cartridgeName(data.cartridge) ?? 'Search cartridges'}
                picked={cartridgeName(data.cartridge) !== undefined}
                describe={(c) => c.name}
                onSelect={(c) => {
                  setCartridgeNames((n) => ({ ...n, [c.id]: c.name }))
                  patch({ cartridge: `catalogue:${c.id}` })
                }}
                noneText="No cartridge found"
                unreachableText="The database is unreachable; the cartridge can be chosen later."
              />
            </div>
            <ManufacturerInput
              label="Manufacturer"
              value={data.manufacturer}
              manufacturers={manufacturers}
              onChange={(manufacturer) => patch({ manufacturer })}
            />
            <TextInput
              label="Model"
              maxLength={200}
              value={data.model ?? ''}
              onChange={(e) => patch({ model: e.currentTarget.value })}
            />
            {firearmFields.map((spec) => (
              <SiField
                key={spec.key}
                spec={spec}
                system={system}
                si={fieldSi(spec, data[spec.key])}
                onChange={(si) => patch({ [spec.key]: fieldStored(spec, si) })}
              />
            ))}
            <div className="firearm-row">
              <span className="firearm-label" id="firearm-twist-hand">
                Twist direction
              </span>
              <SegmentedControl
                size={controlSize.row.toggle}
                aria-labelledby="firearm-twist-hand"
                value={data.twistHand}
                onChange={(v) => patch({ twistHand: v as 'right' | 'left' })}
                data={[
                  { value: 'right', label: 'Right' },
                  { value: 'left', label: 'Left' },
                ]}
              />
            </div>
            <Textarea
              className="wide"
              label="Chamber and other notes"
              autosize
              minRows={1}
              maxRows={4}
              maxLength={10000}
              value={data.notes ?? ''}
              onChange={(e) => patch({ notes: e.currentTarget.value })}
            />
          </SimpleGrid>
        </Tabs.Panel>

        <Tabs.Panel value="optics">
          {data.optics.length > 0 && (
            <Table.ScrollContainer minWidth={760}>
              <Table className="firearm-table" withRowBorders={false}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Kind</Table.Th>
                    <Table.Th>Name</Table.Th>
                    <Table.Th>Turret marking</Table.Th>
                    <Table.Th>Click value</Table.Th>
                    <Table.Th>Turret travel</Table.Th>
                    <Table.Th>Magnification, lowest</Table.Th>
                    <Table.Th>Magnification, highest</Table.Th>
                    <Table.Th>Reticle</Table.Th>
                    <Table.Th>
                      <span className="visually-hidden">Remove</span>
                    </Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {data.optics.map((o, i) => (
                    <Table.Tr key={o.id}>
                      <Table.Td>
                        <NativeSelect
                          label={`Kind, optic ${i + 1}`}
                          data={opticKinds}
                          value={o.kind}
                          onChange={(e) =>
                            setOptic(i, { kind: e.currentTarget.value as Optic['kind'] })
                          }
                        />
                      </Table.Td>
                      <Table.Td>
                        <TextInput
                          label={`Name, optic ${i + 1}`}
                          maxLength={200}
                          placeholder={`Optic ${i + 1}`}
                          value={o.name}
                          onChange={(e) => setOptic(i, { name: e.currentTarget.value })}
                        />
                      </Table.Td>
                      <Table.Td>
                        <NativeSelect
                          label={`Turret marking, optic ${i + 1}`}
                          data={[
                            { value: '', label: 'Not set' },
                            { value: 'mrad', label: 'mrad' },
                            { value: 'MOA', label: 'MOA' },
                          ]}
                          value={o.clickUnit ?? ''}
                          onChange={(e) =>
                            setOptic(i, {
                              clickUnit: (e.currentTarget.value || undefined) as Optic['clickUnit'],
                            })
                          }
                        />
                      </Table.Td>
                      {opticFields.map((spec) => (
                        <Table.Td key={spec.key}>
                          <SiField
                            spec={{ ...spec, label: `${spec.label}, optic ${i + 1}` }}
                            system={system}
                            si={fieldSi(spec, o[spec.key])}
                            onChange={(si) => setOptic(i, { [spec.key]: fieldStored(spec, si) })}
                            error={crossError('optics', i, spec.key)}
                          />
                        </Table.Td>
                      ))}
                      <Table.Td>
                        <TextInput
                          label={`Reticle, optic ${i + 1}`}
                          maxLength={200}
                          value={o.reticle ?? ''}
                          onChange={(e) => setOptic(i, { reticle: e.currentTarget.value })}
                        />
                      </Table.Td>
                      <Table.Td>
                        <ActionIcon
                          size={controlSize.row.icon}
                          variant="subtle"
                          color="red"
                          disabled={mounted(o.id)}
                          aria-label={`Remove ${opticName(o.id)}${mounted(o.id) ? ', mounted in a configuration' : ''}`}
                          title={mounted(o.id) ? 'Mounted in a configuration' : undefined}
                          onClick={() => patch({ optics: data.optics.filter((x) => x !== o) })}
                        >
                          <Trash size={16} aria-hidden="true" />
                        </ActionIcon>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          )}
          <Button
            variant="default"
            size={controlSize.row.button}
            leftSection={<Plus size={14} aria-hidden="true" />}
            onClick={() => {
              const id = freeId(
                'o',
                data.optics.map((o) => o.id),
              )
              patch({ optics: [...data.optics, { id, kind: 'scope', name: '' }] })
            }}
          >
            Add optic
          </Button>
        </Tabs.Panel>

        <Tabs.Panel value="configurations">
          {data.configurations.map((c, i) => {
            const title = c.name || `Configuration ${i + 1}`
            return (
              <Card key={c.id} withBorder padding="xs" mb="sm">
                <Group justify="space-between" wrap="nowrap" mb={4}>
                  <Title order={3} size="h6" m={0}>
                    {title}
                  </Title>
                  <ActionIcon
                    size={controlSize.row.icon}
                    variant="subtle"
                    color="red"
                    aria-label={`Remove ${title}`}
                    onClick={() =>
                      patch({
                        configurations: data.configurations.filter((x) => x !== c),
                        active: data.active === c.id ? undefined : data.active,
                      })
                    }
                  >
                    <Trash size={16} aria-hidden="true" />
                  </ActionIcon>
                </Group>
                <SimpleGrid
                  className="firearm-grid"
                  cols={{ base: 1, sm: 2 }}
                  spacing="lg"
                  verticalSpacing="sm"
                >
                  <TextInput
                    label="Configuration name"
                    maxLength={200}
                    value={c.name}
                    onChange={(e) => setConfig(i, { name: e.currentTarget.value })}
                  />
                  <Checkbox
                    className="firearm-check"
                    label="Active, on the firearm now"
                    checked={data.active === c.id}
                    onChange={(e) => patch({ active: e.currentTarget.checked ? c.id : undefined })}
                  />
                  <TextInput
                    label="Mounted on"
                    type="date"
                    value={c.mounted ?? ''}
                    onChange={(e) => setConfig(i, { mounted: e.currentTarget.value || undefined })}
                  />
                  <TextInput
                    label="Removed on"
                    type="date"
                    value={c.removed ?? ''}
                    error={crossError('configurations', i, 'removed')}
                    onChange={(e) => setConfig(i, { removed: e.currentTarget.value || undefined })}
                  />
                </SimpleGrid>
                <Table.ScrollContainer minWidth={720} mt="xs">
                  <Table
                    className="firearm-table"
                    withRowBorders={false}
                    aria-label={`Mounts of ${title}`}
                  >
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Optic</Table.Th>
                        <Table.Th>Sight height</Table.Th>
                        <Table.Th>Offset</Table.Th>
                        <Table.Th>Cant</Table.Th>
                        <Table.Th>Zero range</Table.Th>
                        <Table.Th>Zero notes</Table.Th>
                        <Table.Th>
                          <span className="visually-hidden">Remove</span>
                        </Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {c.mounts.map((m, k) => (
                        // biome-ignore lint/suspicious/noArrayIndexKey: mounts have no id and keep their order
                        <Table.Tr key={k}>
                          <Table.Td>
                            <NativeSelect
                              label={`Optic, ${title} mount ${k + 1}`}
                              data={data.optics.map((o) => ({
                                value: o.id,
                                label: opticName(o.id),
                              }))}
                              value={m.optic}
                              onChange={(e) => setMount(i, k, { optic: e.currentTarget.value })}
                            />
                          </Table.Td>
                          {mountFields.map((spec) => (
                            <Table.Td key={spec.key}>
                              <SiField
                                spec={{
                                  ...spec,
                                  label: `${spec.label}, ${title} mount ${k + 1}`,
                                }}
                                system={system}
                                si={fieldSi(spec, m[spec.key])}
                                onChange={(si) =>
                                  setMount(i, k, { [spec.key]: fieldStored(spec, si) })
                                }
                              />
                            </Table.Td>
                          ))}
                          <Table.Td>
                            <TextInput
                              label={`Zero conditions and ammunition, ${title} mount ${k + 1}`}
                              maxLength={1000}
                              value={m.zeroNotes ?? ''}
                              onChange={(e) => setMount(i, k, { zeroNotes: e.currentTarget.value })}
                            />
                          </Table.Td>
                          <Table.Td>
                            <ActionIcon
                              size={controlSize.row.icon}
                              variant="subtle"
                              color="red"
                              disabled={c.mounts.length === 1}
                              aria-label={`Remove ${title} mount ${k + 1}`}
                              onClick={() =>
                                setConfig(i, { mounts: c.mounts.filter((x) => x !== m) })
                              }
                            >
                              <Trash size={16} aria-hidden="true" />
                            </ActionIcon>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
                <Table.ScrollContainer minWidth={720}>
                  <Table
                    className="firearm-table"
                    withRowBorders={false}
                    aria-label={`Zero air and drag factor of ${title}`}
                  >
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Optic</Table.Th>
                        {zeroFields.map((spec) => (
                          <Table.Th key={spec.key}>{spec.label}</Table.Th>
                        ))}
                        <Table.Th>Drag factor source</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {c.mounts.map((m, k) => (
                        // biome-ignore lint/suspicious/noArrayIndexKey: mounts have no id and keep their order
                        <Table.Tr key={k}>
                          <Table.Th scope="row">{opticName(m.optic)}</Table.Th>
                          {zeroFields.map((spec) => (
                            <Table.Td key={spec.key}>
                              <SiField
                                spec={{
                                  ...spec,
                                  label: `${spec.label}, ${title} mount ${k + 1}`,
                                }}
                                system={system}
                                si={fieldSi(spec, m[spec.key])}
                                onChange={(si) =>
                                  setMount(i, k, { [spec.key]: fieldStored(spec, si) })
                                }
                              />
                            </Table.Td>
                          ))}
                          <Table.Td>
                            <TextInput
                              label={`Drag factor source, ${title} mount ${k + 1}`}
                              maxLength={200}
                              value={m.dragFactorSource ?? ''}
                              onChange={(e) =>
                                setMount(i, k, {
                                  dragFactorSource: e.currentTarget.value || undefined,
                                })
                              }
                            />
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
                <Button
                  variant="default"
                  size={controlSize.row.button}
                  leftSection={<Plus size={14} aria-hidden="true" />}
                  disabled={c.mounts.length >= 4}
                  style={{ alignSelf: 'flex-start' }}
                  onClick={() => {
                    const optic =
                      data.optics.find((o) => !c.mounts.some((m) => m.optic === o.id)) ??
                      data.optics[0]
                    if (!optic) return
                    setConfig(i, {
                      mounts: [
                        ...c.mounts,
                        {
                          optic: optic.id,
                          sightHeight: empty,
                          zeroRange: empty,
                        },
                      ],
                    })
                  }}
                >
                  Add mount
                </Button>
              </Card>
            )
          })}
          <Group gap="sm">
            <Button
              variant="default"
              size={controlSize.row.button}
              leftSection={<Plus size={14} aria-hidden="true" />}
              disabled={!data.optics.length}
              onClick={() => {
                const [firstOptic] = data.optics
                if (!firstOptic) return
                const id = freeId(
                  'c',
                  data.configurations.map((c) => c.id),
                )
                patch({
                  configurations: [
                    ...data.configurations,
                    {
                      id,
                      name: '',
                      mounts: [{ optic: firstOptic.id, sightHeight: empty, zeroRange: empty }],
                    },
                  ],
                  active: data.active ?? id,
                })
              }}
            >
              Add configuration
            </Button>
            {!data.optics.length && (
              <Text size="sm" c="dimmed">
                Add an optic first.
              </Text>
            )}
          </Group>
        </Tabs.Panel>
      </Tabs>
    </section>
  )
}
