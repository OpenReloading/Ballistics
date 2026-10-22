import { z } from 'zod'

/** The pattern of {@link recordId}. */
export const recordIdRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** Lowercase kebab-case id, also the record's file name without `.json`. */
export const recordId = z.string().regex(recordIdRegex)
