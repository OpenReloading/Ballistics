import { useLingui } from '@lingui/react'
import { NumberInput, SimpleGrid } from '@mantine/core'
import { useState } from 'react'
import { loadEnglish } from '../i18n/lingui.ts'
import { type MatchCourse, matchRounds } from '../lib/match-rounds.ts'
import englishMessages from '../locales/en/components/match-rounds.json' with { type: 'json' }
import { Panel } from './panel.tsx'

loadEnglish(englishMessages)

/** A field's number, `undefined` while empty. */
const typed = (v: number | string) => (typeof v === 'number' ? v : undefined)

const below: ('label' | 'input' | 'description' | 'error')[] = [
  'label',
  'input',
  'description',
  'error',
]

// the match sense of Events, not the competition events: a context the runtime type lacks
const eventsLabel = /*i18n*/ { id: 'matchRounds.events', context: 'match', message: 'Events' }

/** Nothing is stored: the fields live while the page is open. */
export function MatchRounds({ course }: { course: MatchCourse }) {
  const { i18n } = useLingui()
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
    <Panel
      id="match-rounds"
      title={i18n._({ id: 'matchRounds.title', message: 'Rounds for a match' })}
    >
      {course.shots !== undefined && (
        <p className="record-note">
          {i18n._({
            id: 'matchRounds.shotsStated',
            message: 'Shots per event: {count}',
            values: { count: course.shots },
          })}
        </p>
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
            label={i18n._({ id: 'matchRounds.shots', message: 'Shots per event' })}
            description={i18n._({
              id: 'matchRounds.shotsUnstated',
              message: 'The targets of this discipline state no shot count.',
            })}
            inputWrapperOrder={below}
            {...whole}
            value={shots}
            onChange={setShots}
          />
        )}
        <NumberInput label={i18n._(eventsLabel)} {...whole} value={events} onChange={setEvents} />
        <NumberInput
          label={i18n._({ id: 'matchRounds.sighters', message: 'Sighters per event' })}
          inputWrapperOrder={below}
          {...(course.openSighters && {
            description: i18n._({
              id: 'matchRounds.ruleBook',
              message: 'Rule book: {value}',
              values: {
                value:
                  course.openSighters === 'unlimited'
                    ? i18n._({ id: 'matchRounds.anyNumber', message: 'Any number' })
                    : i18n._({ id: 'matchRounds.notStated', message: 'Not stated' }),
              },
            }),
          })}
          {...whole}
          value={sighters}
          onChange={setSighters}
        />
        <NumberInput
          label={i18n._({ id: 'matchRounds.reserve', message: 'Reserve, %' })}
          min={0}
          allowNegative={false}
          hideControls
          value={reserve}
          onChange={setReserve}
        />
        <NumberInput
          label={i18n._({ id: 'matchRounds.onHand', message: 'Rounds on hand' })}
          {...whole}
          value={onHand}
          onChange={setOnHand}
        />
      </SimpleGrid>
      <MatchReadout result={result} />
    </Panel>
  )
}

/** Empty while a field it needs is empty; a live region either way. */
export function MatchReadout({ result }: { result: ReturnType<typeof matchRounds> }) {
  const { i18n } = useLingui()
  const difference = result?.difference
  return (
    <div role="status">
      {result && (
        <dl className="readouts match-readouts">
          <div>
            <dt>{i18n._({ id: 'matchRounds.needed', message: 'Rounds needed' })}</dt>
            <dd>{result.needed}</dd>
          </div>
          {difference !== undefined && (
            <div>
              <dt>
                {difference < 0
                  ? i18n._({ id: 'matchRounds.short', message: 'Rounds short' })
                  : i18n._({ id: 'matchRounds.leftOver', message: 'Rounds left over' })}
              </dt>
              <dd className={difference < 0 ? 'exceeded' : undefined}>{Math.abs(difference)}</dd>
            </div>
          )}
        </dl>
      )}
    </div>
  )
}
