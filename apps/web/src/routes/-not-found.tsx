import { PageNotFound } from '../components/page-not-found.tsx'

/** The not-found page, kept out of search indexes. */
export function NotFoundPage() {
  return (
    <>
      <meta name="robots" content="noindex" />
      <PageNotFound />
    </>
  )
}
