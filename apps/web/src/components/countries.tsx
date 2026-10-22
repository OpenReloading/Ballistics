import AT from 'country-flag-icons/react/3x2/AT'
import AU from 'country-flag-icons/react/3x2/AU'
import BE from 'country-flag-icons/react/3x2/BE'
import CA from 'country-flag-icons/react/3x2/CA'
import CH from 'country-flag-icons/react/3x2/CH'
import CZ from 'country-flag-icons/react/3x2/CZ'
import DE from 'country-flag-icons/react/3x2/DE'
import FI from 'country-flag-icons/react/3x2/FI'
import FR from 'country-flag-icons/react/3x2/FR'
import GB from 'country-flag-icons/react/3x2/GB'
import IL from 'country-flag-icons/react/3x2/IL'
import IT from 'country-flag-icons/react/3x2/IT'
import JP from 'country-flag-icons/react/3x2/JP'
import NO from 'country-flag-icons/react/3x2/NO'
import PT from 'country-flag-icons/react/3x2/PT'
import RU from 'country-flag-icons/react/3x2/RU'
import SE from 'country-flag-icons/react/3x2/SE'
import SI from 'country-flag-icons/react/3x2/SI'
import TR from 'country-flag-icons/react/3x2/TR'
import US from 'country-flag-icons/react/3x2/US'

/**
 * The flags of the codes the records use, one import each: the namespace import puts all 250 flags
 * in the browser bundle. `test/countries.test.ts` fails for a record code missing here.
 */
export const flags: Record<string, typeof US> = {
  AT,
  AU,
  BE,
  CA,
  CH,
  CZ,
  DE,
  FI,
  FR,
  GB,
  IL,
  IT,
  JP,
  NO,
  PT,
  RU,
  SE,
  SI,
  TR,
  US,
}

/**
 * Countries as a spec strip item, each after its flag (country-flag-icons, MIT; the name beside it is
 * the flag's text alternative); a former state as text only.
 */
export function Countries({
  items,
  title,
  as: Tag = 'li',
}: {
  items: { name: string; code?: string }[]
  /** Hover text for the whole item. */
  title?: string
  /** `span` inside a list of its own. */
  as?: 'li' | 'span'
}) {
  return (
    <Tag className="countries" title={title}>
      {items.map(({ name, code }) => {
        const Flag = code ? flags[code] : undefined
        return (
          <span key={name} className="country">
            {Flag && <Flag aria-hidden="true" className="flag" />}
            {name}
          </span>
        )
      })}
    </Tag>
  )
}
