'use client'

import { NumberInput, SimpleGrid } from '@mantine/core'
import { useState } from 'react'
import { useTranslation } from '../i18n/language.ts'
import { type MatchCourse, matchRounds } from '../lib/match-rounds.ts'
import { Panel } from './panel.tsx'

/** A field's number, `undefined` while empty. */
const typed = (v: number | string) => (typeof v === 'number' ? v : undefined)

/**
 * The rounds a match of the discipline takes, against the rounds on hand typed. Nothing is
 * stored: the fields live while the page is open.
 */
export function MatchRounds({ course }: { course: MatchCourse }) {
  const { t } = useTranslation()
  const [shots, setShots] = useState<number | string>('')
  const [events, setEvents] = useState<number | string>(1)
  const [sighters, setSighters] = useState<number | string>(course.sighters)
  const [reserve, setReserve] = useState<number | string>(10)
  const [onHand, setOnHand] = useState<number | string>('')
  const result = matchRounds({
    shots: course.shots ?? typed(shots),
    sighters: typed(sighters),
    events: typed(events),
    reserve: typed(reserve),
    onHand: typed(onHand),
  })
  const whole = { min: 0, allowDecimal: false, allowNegative: false, hideControls: true }
  return (
    <Panel id="match-rounds" title={t('Rounds for a match')}>
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg" verticalSpacing="sm">
        {course.shots === undefined ? (
          <NumberInput
            label={t('Shots per event')}
            description={t('The targets of this discipline state no shot count.')}
            {...whole}
            value={shots}
            onChange={setShots}
          />
        ) : (
          <p>{t('Shots per event: {count}', { count: course.shots })}</p>
        )}
        <NumberInput
          label={t('match\u0004Events')}
          {...whole}
          value={events}
          onChange={setEvents}
        />
        <NumberInput
          label={t('Sighters per event')}
          {...(course.openSighters && {
            description: t('Rule book: {value}', {
              value: course.openSighters === 'unlimited' ? t('Any number') : t('Not stated'),
            }),
          })}
          {...whole}
          value={sighters}
          onChange={setSighters}
        />
        <NumberInput
          label={t('Reserve, %')}
          min={0}
          allowNegative={false}
          hideControls
          value={reserve}
          onChange={setReserve}
        />
        <NumberInput label={t('Rounds on hand')} {...whole} value={onHand} onChange={setOnHand} />
      </SimpleGrid>
      <p role="status">
        {result?.difference === undefined
          ? result && t('Needed {needed}', { needed: result.needed })
          : result.difference < 0
            ? t('Needed {needed}, typed {typed}: short by {difference}', {
                needed: result.needed,
                typed: result.needed + result.difference,
                difference: -result.difference,
              })
            : t('Needed {needed}, typed {typed}: {difference} over', {
                needed: result.needed,
                typed: result.needed + result.difference,
                difference: result.difference,
              })}
      </p>
    </Panel>
  )
}
