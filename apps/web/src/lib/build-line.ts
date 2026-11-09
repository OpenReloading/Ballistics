/** What the build line names: set at build time by `next.config.ts`. */
export interface Build {
  /** `next` for the next edition (`PAGES_EDITION`), `release` for a Pages build of a release, else `development`. */
  edition: 'release' | 'next' | 'development'
  /** The version of `apps/web/package.json`. */
  version: string
  /** The short commit of the checkout, `''` without one. */
  commit: string
  /** The build day, `YYYY-MM-DD`. */
  day: string
}

/** The same in every language, so bug reports read alike. */
export function buildLine({ edition, version, commit, day }: Build): string {
  const web = `web ${version}`
  const parts =
    edition === 'next'
      ? [commit ? `next ${commit}` : 'next', `after ${web}`]
      : edition === 'development'
        ? ['development', web, commit]
        : [web, commit]
  return [...parts, day].filter(Boolean).join(', ')
}

/** On a printed report, so a filed sheet traces to the build that computed it; the same in every language. */
export function buildTag({ edition, version, commit }: Build): string {
  const parts = edition === 'release' ? [version] : [edition, commit || version]
  return ['Ballistics', ...parts].join(' ')
}
