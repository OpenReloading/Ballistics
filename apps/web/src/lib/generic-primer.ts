/** The generic primer of a cartridge: its sourced primer size, standard or magnum, named by the size; no product. */

import type { MessageDescriptor } from '@lingui/core'
import type { Cartridge, PrimerSize } from '@rangefoundry/schema'
import { loadEnglish } from '../i18n/lingui.ts'
import englishMessages from '../locales/en/lib/generic-primer.json' with { type: 'json' }

loadEnglish(englishMessages)

/** A primer of a size, not a product: no maker, product number, cup or compound. */
export interface GenericPrimer {
  size: PrimerSize
  magnum: boolean
  name: MessageDescriptor
}

const standardNames: Readonly<Record<PrimerSize, MessageDescriptor>> = {
  'small-rifle': /*i18n*/ { id: 'values.smallRifle', message: 'Small rifle' },
  'large-rifle': /*i18n*/ { id: 'values.largeRifle', message: 'Large rifle' },
  'small-pistol': /*i18n*/ { id: 'values.smallPistol', message: 'Small pistol' },
  'large-pistol': /*i18n*/ { id: 'values.largePistol', message: 'Large pistol' },
  shotshell: /*i18n*/ { id: 'values.shotshell', message: 'Shotshell' },
}

const magnumNames: Readonly<Partial<Record<PrimerSize, MessageDescriptor>>> = {
  'small-rifle': /*i18n*/ { id: 'genericPrimer.smallRifleMagnum', message: 'Small rifle magnum' },
  'large-rifle': /*i18n*/ { id: 'genericPrimer.largeRifleMagnum', message: 'Large rifle magnum' },
  'small-pistol': /*i18n*/ {
    id: 'genericPrimer.smallPistolMagnum',
    message: 'Small pistol magnum',
  },
  'large-pistol': /*i18n*/ {
    id: 'genericPrimer.largePistolMagnum',
    message: 'Large pistol magnum',
  },
}

/** The generic primer of `cartridge`; none where the cartridge has no sourced primer size. */
export function genericPrimer(
  cartridge: Pick<Cartridge, 'defaults'> | undefined,
): GenericPrimer | undefined {
  const size = cartridge?.defaults?.primerSize
  if (size === undefined) return undefined
  const magnumName = cartridge?.defaults?.primerMagnum ? magnumNames[size] : undefined
  return magnumName
    ? { size, magnum: true, name: magnumName }
    : { size, magnum: false, name: standardNames[size] }
}
