import dynamic from '@/platform/dynamic.tsx'
import { loadEnglish } from '../i18n/lingui.ts'
import englishMessages from '../locales/en/components/target-designer-loader.json' with {
  type: 'json',
}
import { DesignerLoading } from './designer-loader.tsx'

loadEnglish(englishMessages)

/** The target face designer, loaded in the browser only, apart from the route; its bar is prerendered. */
const Designer = dynamic(() => import('./target-designer.tsx').then((m) => m.TargetDesigner), {
  loading: () => (
    <DesignerLoading title={/*i18n*/ { id: 'page.targetsDesigner', message: 'Target designer' }} />
  ),
})

export const TargetDesignerLoader = () => <Designer />
