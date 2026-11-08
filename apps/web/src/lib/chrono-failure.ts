import type { Say } from '../i18n/translate.ts'

/**
 * Why a chronograph file was not read, worded where it is shown. The words load only now, so a
 * page that reads such files carries none of them; when they do not load, the reason is generic.
 */
export async function chronoFailureSay(error: unknown): Promise<Say> {
  const words = await import('./chrono-diagnostics.ts').catch(() => undefined)
  return (t) => words?.chronoErrorText(error, t) ?? t('The file was not read.')
}
