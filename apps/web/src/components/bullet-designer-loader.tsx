import dynamic from '@/platform/dynamic.tsx'
import { loadEnglish } from '../i18n/lingui.ts'
import englishMessages from '../locales/en/components/bullet-designer-loader.json' with {
  type: 'json',
}
import { DesignerLoading } from './designer-loader.tsx'

loadEnglish(englishMessages)

/** The bullet designer, loaded in the browser only, apart from the route; its bar is prerendered. */
const Designer = dynamic(() => import('./bullet-designer.tsx').then((m) => m.BulletDesigner), {
  loading: () => (
    <DesignerLoading title={/*i18n*/ { id: 'page.bulletsDesigner', message: 'Bullet designer' }} />
  ),
})

export const BulletDesignerLoader = () => <Designer />
