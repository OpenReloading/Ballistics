/** Undefined when unset or empty, so no link renders. */
export function repositoryUrl(value: string | undefined): string | undefined {
  return value?.trim() || undefined
}
