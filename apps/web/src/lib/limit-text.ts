import type { Translator } from '../i18n/translate.ts'

/** The part of a limit these texts read: `typed` is a Pmax the user typed, no CIP value. */
type Named = { symbol: string; typed?: boolean | undefined }

/** The limit with its value: "CIP Pmax 3500 bar" or "your Pmax 3500 bar". */
export const limitWithValue = (l: Named, limit: string, t: Translator['t']) =>
  l.typed
    ? t('Your Pmax {limit}', { limit })
    : t('CIP {symbol} {limit}', { symbol: l.symbol, limit })

/** The share of the limit, with its value when `limit` is given. */
export function limitShare(l: Named, percent: string | number, t: Translator['t'], limit?: string) {
  if (limit === undefined)
    return l.typed
      ? t('{percent} % of your Pmax', { percent })
      : t('{percent} % of CIP {symbol}', { percent, symbol: l.symbol })
  return l.typed
    ? t('{percent} % of your Pmax {limit}', { percent, limit })
    : t('{percent} % of CIP {symbol} {limit}', { percent, symbol: l.symbol, limit })
}
