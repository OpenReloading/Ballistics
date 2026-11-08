import { z } from 'zod'
import { type QuantitySchema, quantity } from './units.ts'

/** A length above zero in the stored unit (mm). */
export const positiveLength = (): QuantitySchema => quantity('length', z.number().positive())

/** SHA-256 of a file: 64 lowercase hex digits. */
export const sha256: z.ZodString = z.string().regex(/^[0-9a-f]{64}$/)

/** ISO 3166-1 alpha-2 country code. */
export const countryCode: z.ZodString = z.string().regex(/^[A-Z]{2}$/)

/** A colour as `#rrggbb`. */
export const hexColour: z.ZodString = z.string().regex(/^#[0-9a-fA-F]{6}$/)

/** Id of an item inside a user data record (a group, an optic, a saved load). */
export const localId: z.ZodString = z.string().min(1).max(64)

/** A string of user data up to `max` characters. */
export const text = (max: number): z.ZodString => z.string().max(max)
