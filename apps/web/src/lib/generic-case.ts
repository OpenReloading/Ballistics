/** The generic brass case of a cartridge, which a load without a chosen case uses; no product. */

import type { MessageDescriptor } from '@lingui/core'
import type { Cartridge } from '@rangefoundry/schema'
import { loadEnglish } from '../i18n/lingui.ts'
import englishMessages from '../locales/en/lib/generic-case.json' with { type: 'json' }

loadEnglish(englishMessages)

/** A brass case of the cartridge, not a product: no maker, product number or headstamp. Its water capacity is the cartridge's default capacity. */
interface GenericCase {
  material: 'brass'
  /** A Boxer pocket of the cartridge's primer size, where the cartridge has a sourced one. */
  primerPocket?: { type: 'boxer'; size: string }
  name: MessageDescriptor
  values: { name: string }
}

const brassCase = /*i18n*/ { id: 'genericCase.name', message: 'Brass case {name}' }

/** The generic brass case of the cartridge named `name`. */
export function genericCase(name: string, cartridge: Pick<Cartridge, 'defaults'> | undefined) {
  const size = cartridge?.defaults?.primerSize
  return {
    material: 'brass',
    ...(size && { primerPocket: { type: 'boxer', size: size.replace('-', ' ') } }),
    name: brassCase,
    values: { name },
  } satisfies GenericCase
}
