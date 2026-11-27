import dynamic from '@/platform/dynamic.tsx'
import { loadEnglish } from '../i18n/lingui.ts'
import englishMessages from '../locales/en/components/powder-tune-loader.json' with { type: 'json' }
import { DesignerLoading } from './designer-loader.tsx'

loadEnglish(englishMessages)

/** The powder tuning screen, loaded in the browser only, apart from the route; its bar is prerendered. */
const Screen = dynamic(() => import('./powder-tune.tsx').then((m) => m.PowderTune), {
  loading: () => (
    <DesignerLoading title={/*i18n*/ { id: 'page.powdersTune', message: 'Tune a powder' }} />
  ),
})

export const PowderTuneLoader = () => <Screen />
