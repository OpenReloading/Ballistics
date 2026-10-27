import { hostText } from '../lib/disciplines.ts'

/** A federation's homepage: an external link named by its host, above the row's own link in a list. */
export function HomepageLink({ url, tabIndex }: { url: string; tabIndex?: number }) {
  return (
    <a href={url} rel="noopener noreferrer" className="row-action" tabIndex={tabIndex}>
      {hostText(url)}
    </a>
  )
}
