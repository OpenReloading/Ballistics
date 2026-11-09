import {
  handgunBarrelLengthLimit,
  type StructureFields,
  startPressureOf,
} from '@open-reloading/ballistics'
import { msg, type Translator } from '../i18n/translate.ts'
import type { Suggestion } from './input-defaults.ts'
import { citedDefaults } from './workbench-defaults.ts'

const constructionName = {
  lead: msg('lead'),
  plated: msg('plated'),
  jacketed: msg('jacketed'),
  monolithic: msg('monolithic'),
}

/** By bullet construction and barrel class (under 300 mm or not) with a 95 % interval; a fitted powder without its own start pressure ran at the rifle assumption, so a rifle barrel keeps it (`apps/docs/docs/models/interior-m3.md`, "Shot start"). */
export function startPressureDefault(a: {
  barrel: number | undefined
  construction: StructureFields | undefined
  /** The start pressure default of Settings, SI. */
  current: number
  /** The powder's model has no start pressure of its own: it was fitted at `defaultStartPressure` of each load's barrel. */
  fittedPowder?: boolean | undefined
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
  if (tuned) return fallback
  if (a.fittedPowder && a.barrel !== undefined && a.barrel >= handgunBarrelLengthLimit)
    return {
      si: current,
      source: t('the start pressure the powder record was fitted at, barrel 300 mm or longer'),
    }
  const rule = startPressureOf(a.barrel, a.construction)
  if (!rule.construction || !rule.interval) return fallback
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
