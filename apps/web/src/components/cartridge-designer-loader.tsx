import dynamic from '@/platform/dynamic.tsx'
import { loadEnglish } from '../i18n/lingui.ts'
import englishMessages from '../locales/en/components/cartridge-designer-loader.json' with {
  type: 'json',
}
import { DesignerLoading } from './designer-loader.tsx'

loadEnglish(englishMessages)

/** The cartridge designer, loaded in the browser only, apart from the route; its bar is prerendered. */
const Designer = dynamic(
  () => import('./cartridge-designer.tsx').then((m) => m.CartridgeDesigner),
  {
    loading: () => (
      <DesignerLoading
        title={/*i18n*/ { id: 'page.cartridgesDesigner', message: 'Cartridge designer' }}
      />
    ),
  },
)

export const CartridgeDesignerLoader = () => <Designer />
