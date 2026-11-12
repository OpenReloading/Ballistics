import { setupI18n } from '@lingui/core'
import { uiMessages } from '@open-reloading/ui'
import { startTransition, useEffect, useState } from 'react'
import { storageName } from './edition.ts'

const en = {
  'nav.home': 'Home',
  'nav.workbench': 'Workbench',
  'home.title': 'Ballistics',
  'home.lead': 'Simulations, not load data.',
  'record.cartridges': 'Cartridge',
  'record.bullets': 'Bullet',
  'record.powders': 'Powder',
  'record.primers': 'Primer',
  'record.cases': 'Case',
  'record.targets': 'Target',
  'record.federations': 'Federation',
  'record.disciplines': 'Discipline',
  'record.missing': 'There is no such record.',
  'workbench.title': 'Load workbench',
  'workbench.cartridge': 'Cartridge',
  'workbench.charge': 'Charge (gr)',
  'workbench.notes': 'Notes',
  'grid.title': 'Bullets',
  'grid.filter': 'Filter by name',
  'grid.name': 'Name',
  'grid.maker': 'Maker',
  'grid.diameter': 'Diameter (mm)',
  'grid.weight': 'Weight (gr)',
  'grid.bc': 'BC (G1)',
  'grid.length': 'Length (mm)',
  'grid.kind': 'Type',
  'grid.released': 'Released',
}

const de: typeof en = {
  'nav.home': 'Start',
  'nav.workbench': 'Ladebank',
  'home.title': 'Ballistik',
  'home.lead': 'Simulationen, keine Ladedaten.',
  'record.cartridges': 'Patrone',
  'record.bullets': 'Geschoss',
  'record.powders': 'Pulver',
  'record.primers': 'Zündhütchen',
  'record.cases': 'Hülse',
  'record.targets': 'Scheibe',
  'record.federations': 'Verband',
  'record.disciplines': 'Disziplin',
  'record.missing': 'Diesen Datensatz gibt es nicht.',
  'workbench.title': 'Ladebank',
  'workbench.cartridge': 'Patrone',
  'workbench.charge': 'Ladung (gr)',
  'workbench.notes': 'Notizen',
  'grid.title': 'Geschosse',
  'grid.filter': 'Nach Name filtern',
  'grid.name': 'Name',
  'grid.maker': 'Hersteller',
  'grid.diameter': 'Durchmesser (mm)',
  'grid.weight': 'Gewicht (gr)',
  'grid.bc': 'BC (G1)',
  'grid.length': 'Länge (mm)',
  'grid.kind': 'Typ',
  'grid.released': 'Erschienen',
}

// shortcut: plain text in Lingui's compiled form; S4 (lingui compile) replaces this
const compiled = (m: Record<string, string>) =>
  Object.fromEntries(Object.entries(m).map(([k, v]) => [k, [v]]))

// one instance per language, switched through React state: activating a shared instance changes the text of
// route boundaries that hydrate later, which React reports as #418
export const i18ns = {
  en: setupI18n({ locale: 'en', messages: { en: { ...uiMessages.en, ...compiled(en) } } }),
  de: setupI18n({ locale: 'de', messages: { de: { ...uiMessages.de, ...compiled(de) } } }),
}

export const languageKey = storageName('language')

/** The stored language, applied after hydration: the prerendered HTML is English (one page tree, no locale path). */
export function useStoredLanguage() {
  const [language, setLanguage] = useState<'en' | 'de'>('en')
  useEffect(() => {
    const stored = localStorage.getItem(languageKey)
    if (stored === 'de') startTransition(() => setLanguage(stored))
  }, [])
  useEffect(() => {
    document.documentElement.lang = language
  }, [language])
  return i18ns[language]
}
