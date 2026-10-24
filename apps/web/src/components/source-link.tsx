import type { Source } from '@openreloading/schema'

/** A source title, linked when it has a URL, and its page. */
export function SourceLink({ source }: { source: Source }) {
  return (
    <>
      {source.url ? <a href={source.url}>{source.title}</a> : source.title}
      {source.page && `, page ${source.page}`}
    </>
  )
}
