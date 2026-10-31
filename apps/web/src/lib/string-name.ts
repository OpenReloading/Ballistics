import type { Translator } from '../i18n/translate.ts'

/** Label "String n" or "String n: label" for the string at zero-based index `k`, in the language of `t`. */
export const stringName = (labels: (string | undefined)[], k: number, t: Translator['t']) =>
  labels[k]
    ? t('String {n}: {label}', { n: k + 1, label: labels[k] })
    : t('String {n}', { n: k + 1 })
