import { PageBar } from './page-bar.tsx'
import { Loading } from './states.tsx'

/** What a designer route shows while its code loads: the prerendered bar and the loading line. */
export const DesignerLoading = ({ title }: { title: string }) => (
  <>
    <PageBar title={title} reserve />
    <Loading what="the designer" />
  </>
)
