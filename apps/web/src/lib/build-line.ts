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

/**
 * The one line naming the running build, for a bug report: `web 0.0.4, abc1234, 2026-10-30`, in the
 * next edition `next abc1234, after web 0.0.4, 2026-10-30`. The same in every language, so a report reads alike.
 */
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

/**
 * The short build name on a printed report, so a filed sheet traces to the build that computed it:
 * `Ballistics 0.0.4`, in the next edition `Ballistics next abc1234`, in a local build
 * `Ballistics development abc1234`, the version where a build has no commit. The same in every language, like the
 * build line.
 */
export function buildTag({ edition, version, commit }: Build): string {
  const parts = edition === 'release' ? [version] : [edition, commit || version]
  return ['Ballistics', ...parts].join(' ')
}
