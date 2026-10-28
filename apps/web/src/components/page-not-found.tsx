import { type Message, msg } from '../i18n/translate.ts'
import { sections } from '../lib/sections.ts'
import { NotFoundState } from './offline-state.tsx'
import { PageBar } from './page-bar.tsx'

/** The page of an address with nothing behind it: the 404 page, and a record page whose data file is missing. */
export function PageNotFound() {
  return (
    <>
      <PageBar title={msg('Page not found')} translated />
      <NotFoundState
        links={sections.flatMap((s): readonly { href: string; label: Message }[] => s.pages)}
      />
    </>
  )
}
