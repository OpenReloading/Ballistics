'use client'

import { ActionIcon, NativeSelect, Tooltip } from '@mantine/core'
import { baseTypes } from '@open-reloading/schema'
import { ArrowCounterClockwise } from '@phosphor-icons/react'
import { useTranslation } from '../i18n/language.ts'
import { type Message, msg, type Translator } from '../i18n/translate.ts'
import {
  type BaseType,
  baseDimensionKeys,
  baseTypeKey,
  boatTailed,
  hollowBased,
} from '../lib/bullet.ts'
import { bulletIncomplete } from '../lib/complete-records.ts'
import { rawWording } from '../lib/record-values.ts'
import { controlSize } from '../lib/theme.ts'
import { say } from '../lib/wording.ts'
import { useLoad } from './workbench-context.ts'

/** The hollow bases get shorter names: the select is too narrow for the full type name. */
const shortLabels: Record<string, Message> = {
  'conical-hollow-base': msg('hollow cone'),
  'rounded-hollow-base': msg('hollow round'),
}

/** A form's name: the German word, in English the type with spaces. */
function label(type: string, t: Translator['t']) {
  const short = shortLabels[type]
  if (short) return t(short)
  const word = say(t, rawWording(type))
  return word === type ? type.replaceAll('-', ' ') : word
}

/** The typed base dimensions a base form cannot have. */
function foreignKeys(type: BaseType | undefined) {
  return baseDimensionKeys.filter((key) =>
    key === 'bulletCavityDiameter' || key === 'bulletCavityDepth'
      ? !hollowBased(type)
      : !boatTailed(type),
  )
}

/**
 * The base form of the bullet: the record's, or the one typed over it. A choice drops the typed
 * dimensions the new form cannot have, the record's own form again drops the typed form.
 */
export function BaseFormField() {
  const { bulletRecord, bulletBaseType, baseChanged, setTypedBullet, markChanged, resetKeys } =
    useLoad()
  const { t } = useTranslation()
  if (!bulletRecord) return null
  const recorded = bulletRecord.base?.type
  const restore = t('Reset {label} to the record value {value}', {
    label: t('Base type'),
    value: recorded ? label(recorded, t) : t('Not given'),
  })
  return (
    <NativeSelect
      size={controlSize.row.input}
      label={t('Base type')}
      description={
        bulletIncomplete(bulletRecord) && !recorded && !bulletBaseType
          ? t('Not in this record, which only names the bullet: choose the base type.')
          : undefined
      }
      value={bulletBaseType ?? recorded ?? ''}
      data={[
        ...(recorded ? [] : [{ value: '', label: t('Not given') }]),
        ...baseTypes.options.map((o) => ({ value: o, label: label(o, t) })),
      ]}
      rightSection={
        baseChanged ? (
          <Tooltip label={restore}>
            <ActionIcon
              variant="subtle"
              size={24}
              className="field-action"
              aria-label={restore}
              onClick={() => resetKeys([baseTypeKey])}
            >
              <ArrowCounterClockwise size={16} aria-hidden="true" />
            </ActionIcon>
          </Tooltip>
        ) : undefined
      }
      rightSectionPointerEvents={baseChanged ? 'all' : 'none'}
      onChange={(e) => {
        const type = baseTypes.safeParse(e.currentTarget.value).data
        const foreign = foreignKeys(type)
        markChanged()
        setTypedBullet((f) => {
          const kept = Object.fromEntries(
            Object.entries(f).filter(([k]) => k !== baseTypeKey && !foreign.includes(k)),
          )
          return type && type !== recorded
            ? { ...kept, [baseTypeKey]: { text: type, si: undefined } }
            : kept
        })
      }}
    />
  )
}
