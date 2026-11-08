import type { Say } from '../i18n/translate.ts'

/** The words load only now, so a page reading such files carries none; generic when they fail to load. */
export async function chronoFailureSay(error: unknown): Promise<Say> {
  const words = await import('./chrono-diagnostics.ts').catch(() => undefined)
  return (t) => words?.chronoErrorText(error, t) ?? t('The file was not read.')
}
