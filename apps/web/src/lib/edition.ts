import { edition } from '@/platform/edition.ts'
import { editionName } from './offline.ts'

export { basePath, edition } from '@/platform/edition.ts'

/** The name of a database, local storage key or cache in this edition (`next:` ahead of it in `next`). */
export const storageName = (name: string) => editionName(edition, name)
