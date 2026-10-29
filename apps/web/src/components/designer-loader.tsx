import type { Message } from '../i18n/translate.ts'
import { PageBar } from './page-bar.tsx'
import { Loading } from './states.tsx'

/** What a designer route shows while its code loads: the prerendered bar and the loading line. */
export const DesignerLoading = ({ title }: { title: Message }) => (
  <>
    <PageBar title={title} translated reserve />
    <Loading what="the designer" />
  </>
)
