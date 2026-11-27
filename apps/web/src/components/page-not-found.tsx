import { NotFoundState } from './offline-state.tsx'

/** The page of an address with nothing behind it: the 404 page, and a record page whose data file is missing. */
export function PageNotFound() {
  return <NotFoundState />
}
