/**
 * The source repository link from `NEXT_PUBLIC_REPOSITORY_URL`: the value as set, or
 * `undefined` when it is unset or empty, so no link is rendered.
 */
export function repositoryUrl(value: string | undefined): string | undefined {
  return value?.trim() || undefined
}
