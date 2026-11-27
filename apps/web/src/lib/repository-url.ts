/** Undefined when unset or empty, so no link renders. */
export function repositoryUrl(value: string | undefined): string | undefined {
  return value?.trim() || undefined
}

/** The source of the running build (AGPL section 13): the repository, else this one, at the build's commit, else at its release tag. */
export function sourceUrl(repository: string | undefined, commit: string, version: string): string {
  return `${repositoryUrl(repository) ?? 'https://github.com/OpenReloading/Ballistics'}/tree/${commit || `web-v${version}`}`
}
