import type { ResistanceGap } from '@rangefoundry/ballistics'
import { type Message, msg } from '../i18n/translate.ts'

/** What a run lacks for a powder record's bore resistance: the gaps of ballistics and one of the app's. */
export type Gap = ResistanceGap | 'grooveNotLoaded'

/** The words of each gap. */
export const gapWords = {
  cartridgeRecord: msg('a cartridge record'),
  bulletLength: msg('a bullet length'),
  grooveNotLoaded: msg("the cartridge record's groove diameter (not loaded)"),
} satisfies Record<Gap, Message>
