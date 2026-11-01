'use client'

import { NumberInput, SimpleGrid } from '@mantine/core'
import { useState } from 'react'
import { useTranslation } from '../i18n/language.ts'
import { type MatchCourse, matchRounds } from '../lib/match-rounds.ts'
import { Panel } from './panel.tsx'

/** A field's number, `undefined` while empty. */
const typed = (v: number | string) => (typeof v === 'number' ? v : undefined)

const below: ('label' | 'input' | 'description' | 'error')[] = [
  'label',
  'input',
  'description',
  'error',
]

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
  // a field's description under it: the fields of the row stay level
  return (
    <Panel id="match-rounds" title={t('Rounds for a match')}>
      {course.shots !== undefined && (
        <p className="record-note">{t('Shots per event: {count}', { count: course.shots })}</p>
      )}
      {/* one row from 48em, in the order a match is planned: shots where no target states them */}
      <SimpleGrid
        cols={{ base: 2, sm: course.shots === undefined ? 5 : 4 }}
        spacing="sm"
        verticalSpacing="sm"
        className="match-fields"
      >
        {course.shots === undefined && (
          <NumberInput
            label={t('Shots per event')}
            description={t('The targets of this discipline state no shot count.')}
            inputWrapperOrder={below}
            {...whole}
            value={shots}
            onChange={setShots}
          />
        )}
        <NumberInput
          label={t('match\u0004Events')}
          {...whole}
          value={events}
          onChange={setEvents}
        />
        <NumberInput
          label={t('Sighters per event')}
          inputWrapperOrder={below}
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
      <MatchReadout result={result} />
    </Panel>
  )
}

/**
 * The rounds needed as a readout, and with rounds on hand typed the rounds short (marked) or left
 * over. Empty while a field it needs is empty; a live region either way.
 */
export function MatchReadout({ result }: { result: ReturnType<typeof matchRounds> }) {
  const { t } = useTranslation()
  const difference = result?.difference
  return (
    <div role="status">
      {result && (
        <dl className="readouts match-readouts">
          <div>
            <dt>{t('Rounds needed')}</dt>
            <dd>{result.needed}</dd>
          </div>
          {difference !== undefined && (
            <div>
              <dt>{difference < 0 ? t('Rounds short') : t('Rounds left over')}</dt>
              <dd className={difference < 0 ? 'exceeded' : undefined}>{Math.abs(difference)}</dd>
            </div>
          )}
        </dl>
      )}
    </div>
  )
}
