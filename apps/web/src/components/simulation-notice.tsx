import { useTranslation } from '../i18n/language.ts'
import { NavIcon } from './nav-icons.tsx'

/** "Simulation, not load data" beside a view of a fitted model or its results; printed unless `screenOnly`. */
export function SimulationNotice({ screenOnly = false }: { screenOnly?: boolean }) {
  const { t } = useTranslation()
  return (
    <span className={screenOnly ? 'notice-text screen-only' : 'notice-text'}>
      <NavIcon name="safety" size={14} />
      {t('Simulation, not load data')}
    </span>
  )
}
