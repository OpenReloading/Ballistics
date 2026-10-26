/**
 * The page's own search, set while the workbench is mounted (its search adds records to the load
 * and runs its commands): the shell's Search and Ctrl+K open it instead of the site search.
 */
export const searchHost: {
  page?: (() => void) | undefined
  /** Asked for on the workbench before its search mounted: it opens when it does. */
  wanted?: boolean | undefined
} = {}

const openEvent = 'site-search-open'

/** Opens the shell's search from the page (the home page's search field). */
export const openSiteSearch = () => window.dispatchEvent(new Event(openEvent))

/** The event `openSiteSearch` sends, which `SiteHeader` answers. */
export const siteSearchEvent = openEvent
