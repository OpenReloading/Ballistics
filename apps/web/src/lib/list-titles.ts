import { loadEnglish } from '../i18n/lingui.ts'
import englishMessages from '../locales/en/lib/list-titles.json' with { type: 'json' }

loadEnglish(englishMessages)

/** The page bar title of each list route: its page, loading line, error page and list share it. Shown with `translated` on the page bar. */
export const listTitles = {
  bullets: /*i18n*/ { id: 'page.bullets', message: 'Bullets' },
  cartridges: /*i18n*/ { id: 'page.cartridges', message: 'Cartridges' },
  powders: /*i18n*/ { id: 'page.powders', message: 'Powders' },
  cases: /*i18n*/ { id: 'page.cases', message: 'Brass' },
  primers: /*i18n*/ { id: 'page.primers', message: 'Primers' },
  targets: /*i18n*/ { id: 'page.targets', message: 'Targets' },
  disciplines: /*i18n*/ { id: 'page.disciplines', message: 'Disciplines' },
  federations: /*i18n*/ { id: 'page.federations', message: 'Federations' },
  firearms: /*i18n*/ { id: 'page.firearms', message: 'Firearms' },
  caseGroup: /*i18n*/ { id: 'page.casesEditor', message: 'Brass group' },
}
