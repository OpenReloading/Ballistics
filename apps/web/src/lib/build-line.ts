/** What the build line names: set at build time by `vite.config.mts`. */
export interface Build {
  /** A local build; a Pages build runs in CI. */
  development: boolean
  /** The version of `apps/web/package.json`. */
  version: string
  /** The short commit of the checkout, `''` without one. */
  commit: string
  /** The build day, `YYYY-MM-DD`. */
  day: string
}

/** The same in every language, so bug reports read alike. */
export function buildLine({ development, version, commit, day }: Build): string {
  return [development && 'development', `web ${version}`, commit, day].filter(Boolean).join(', ')
}

/** On a printed report, so a filed sheet traces to the build that computed it; the same in every language. */
export function buildTag({ development, version, commit }: Build): string {
  return ['Ballistics', development && 'development', version, commit].filter(Boolean).join(' ')
}
