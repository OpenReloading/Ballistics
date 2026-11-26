import type { LinguiSay } from '../i18n/translate.ts'

/** The words load only now, so a page reading such files carries none; generic when they fail to load. */
export async function chronoFailureSay(error: unknown): Promise<LinguiSay> {
  const words = await import('./chrono-diagnostics.ts').catch(() => undefined)
  return (t, i18n) => words?.chronoErrorText(error, t, i18n) ?? t('The file was not read.')
}
