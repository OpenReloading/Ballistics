/** The fields of the brass group editor and its refusal, in the language shown. */
import type { I18n, MessageDescriptor } from '@lingui/core'
import { type Case, cartridgeCase } from '@rangefoundry/schema'
import { loadEnglish } from '../i18n/lingui.ts'
import englishMessages from '../locales/en/lib/case-group-fields.json' with { type: 'json' }
import type { FieldSpec } from './field-spec.ts'

loadEnglish(englishMessages)

/** The measured fields of a group of cases, in the form's units and in the order of the editor. */
export const caseGroupFields = [
  {
    key: 'mass',
    label: /*i18n*/ { id: 'caseGroup.caseMass', message: 'Case mass' },
    quantity: 'mass',
    min: 0,
    positive: true,
  },
  {
    key: 'trimLength',
    label: /*i18n*/ { id: 'caseGroup.trimLength', message: 'Trim length' },
    quantity: 'length',
    min: 0,
    positive: true,
  },
  {
    key: 'neckWall',
    label: /*i18n*/ { id: 'caseGroup.neckWall', message: 'Neck wall' },
    quantity: 'length',
    min: 0,
    positive: true,
  },
  {
    key: 'numberOfFirings',
    label: /*i18n*/ { id: 'caseGroup.timesFired', message: 'Times fired' },
    help: /*i18n*/ { id: 'caseGroup.timesFiredHelp', message: 'Firings of these cases so far.' },
    quantity: 'ratio',
    min: 0,
    integer: true,
  },
  {
    key: 'casesMeasured',
    label: /*i18n*/ { id: 'caseGroup.casesMeasured', message: 'Cases measured' },
    help: /*i18n*/ {
      id: 'caseGroup.casesMeasuredHelp',
      message: 'Cases the capacity and the other measured values come from.',
    },
    quantity: 'ratio',
    min: 1,
    positive: true,
    integer: true,
  },
  {
    key: 'spread',
    label: /*i18n*/ { id: 'caseGroup.capacitySpread', message: 'Capacity spread' },
    help: /*i18n*/ {
      id: 'caseGroup.capacitySpreadHelp',
      message: 'Standard deviation of the water capacity over the cases measured.',
    },
    quantity: 'mass',
    min: 0,
  },
] as const satisfies readonly FieldSpec[]

/** The water capacity to the mouth, the one measured value that is a record of its own. */
export const caseGroupCapacitySpec = {
  key: 'capacity',
  label: /*i18n*/ { id: 'caseGroup.waterCapacity', message: 'Water capacity to the mouth' },
  help: /*i18n*/ {
    id: 'caseGroup.waterCapacityHelp',
    message:
      'Mean of the cases measured in this group, for example fired and sized. The workbench uses it as the measured case capacity.',
  },
  quantity: 'capacity',
  min: 0,
  positive: true,
} as const satisfies FieldSpec

const labels: Record<string, MessageDescriptor> = Object.fromEntries(
  [...caseGroupFields, caseGroupCapacitySpec].map((s) => [s.key, s.label]),
)

/** With the field label, in the language of `i18n`; undefined when valid; an empty `name` is refused. */
export function caseGroupProblem(name: string, c: Case, i18n: I18n): string | undefined {
  if (!name) return i18n._({ id: 'caseGroup.enterName', message: 'Enter a name.' })
  if (!c.cartridge)
    return i18n._({ id: 'caseGroup.chooseCartridge', message: 'Choose the cartridge.' })
  const [issue] = cartridgeCase.safeParse(c).error?.issues ?? []
  if (!issue) return
  // a stored quantity is `{ value }`: the field is the key above it
  const field = String(issue.path.findLast((p) => typeof p === 'string' && p !== 'value'))
  const label = labels[field]
  const what = label ? i18n._(label) : field
  return issue.code === 'invalid_type'
    ? i18n._({ id: 'caseGroup.enterNumber', message: '{what}: enter a number.', values: { what } })
    : i18n._({ id: 'caseGroup.notValid', message: '{what}: not valid.', values: { what } })
}
