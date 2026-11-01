import {
  handgunBarrelLengthLimit,
  type StructureFields,
  startPressureOf,
} from '@open-reloading/core'
import { msg, type Translator } from '../i18n/translate.ts'
import type { Suggestion } from './input-defaults.ts'
import { citedDefaults } from './workbench-defaults.ts'

const constructionName = {
  lead: msg('lead'),
  plated: msg('plated'),
  jacketed: msg('jacketed'),
  monolithic: msg('monolithic'),
}

/**
 * The default of the start pressure field (`apps/docs/docs/models/interior-m3.md`, "Shot start"):
 * the construction rule of the chosen bullet and the firearm class (barrel under 300 mm or not)
 * with its 95 % interval, else the value the field held before the rule (the Settings default or
 * the cited one). A default
 * the user changed in Settings is kept.
 */
export function startPressureDefault(a: {
  barrel: number | undefined
  construction: StructureFields | undefined
  /** The start pressure default of Settings, SI. */
  current: number
  show: { text: (si: number) => string; unit: string }
  t: Translator['t']
}): Suggestion {
  const { current, show, t } = a
  const cited = citedDefaults.startPressure
  const tuned = current !== cited.si
  const fallback = {
    si: current,
    source: tuned ? t('your default from Settings') : t(cited.source),
  }
  const rule = startPressureOf(a.barrel, a.construction)
  if (tuned || !rule.construction || !rule.interval) return fallback
  const name = t(constructionName[rule.construction])
  const fill = {
    construction: rule.assumed ? t('{name}, assumed', { name }) : name,
    low: show.text(rule.interval[0]),
    high: show.text(rule.interval[1]),
    unit: show.unit,
  }
  const handgun = (a.barrel ?? 0) < handgunBarrelLengthLimit
  return {
    si: rule.value,
    approximate: true,
    source: handgun
      ? t(
          'handgun load tables, bullet construction {construction}, barrel under 300 mm; approximate, 95 % interval {low} to {high} {unit}',
          fill,
        )
      : t(
          'rifle load tables, bullet construction {construction}, barrel 300 mm or longer; approximate, 95 % interval {low} to {high} {unit}',
          fill,
        ),
  }
}
