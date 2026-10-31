import { NativeSelect } from '@mantine/core'
import type { SessionRecord, ShotGroup } from '@open-reloading/schema'
import { useTranslation } from '../i18n/language.ts'
import { choiceLabel, linkedString, linkString, stringChoices } from '../lib/chrono-link.ts'
import { sessionRef } from '../lib/measurements.ts'
import { controlSize } from '../lib/theme.ts'

/**
 * One picker per ladder group of the open sheet: the chronograph string whose shots are linked, in
 * order, to the shots of the group. None removes the links.
 */
export function LadderChrono({
  groups,
  sessions,
  stepLabels,
  onLink,
}: {
  groups: readonly ShotGroup[]
  sessions: readonly SessionRecord[]
  stepLabels: readonly string[] | undefined
  onLink: (group: string, shots: ShotGroup['shots']) => void
}) {
  const { t } = useTranslation()
  const choices = stringChoices(sessions)
  const ladder = groups.filter((g) => g.ladderStep !== undefined)
  if (choices.length === 0 || ladder.length === 0) return null
  return (
    <div className="ladder-chrono">
      {ladder.map((g) => {
        const link = linkedString(g.shots)
        const at = link
          ? choices.findIndex(
              (c) => sessionRef(c.session.id) === link.session && c.string === link.string,
            )
          : -1
        return (
          <NativeSelect
            key={g.id}
            label={t('Chronograph, {group}', {
              group: t('{name}, step {step}', {
                name: g.name,
                step: stepLabels?.[g.ladderStep ?? 0] ?? (g.ladderStep ?? 0) + 1,
              }),
            })}
            size={controlSize.row.input}
            data={[
              { value: '', label: t('None') },
              ...choices.map((c, i) => ({ value: String(i), label: choiceLabel(c, t) })),
              ...(link && at < 0
                ? [{ value: 'gone', label: t('Session not in this browser'), disabled: true }]
                : []),
            ]}
            value={link ? (at < 0 ? 'gone' : String(at)) : ''}
            onChange={(e) => {
              const v = e.currentTarget.value
              onLink(g.id, linkString(g.shots, v === '' ? undefined : choices[Number(v)]))
            }}
          />
        )
      })}
    </div>
  )
}
