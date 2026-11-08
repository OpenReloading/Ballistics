/**
 * `U` when the annotation `T` and the parser type `U` are assignable both ways, otherwise `never`. An export written
 * `export const x: T = parser satisfies Exact<typeof x, typeof parser>` fails tsc when `T` differs from the parser's type,
 * as in `@open-reloading/schema`. A type only, so the check leaves no code behind. It cannot see what zod types alike:
 * object strictness and what a schema checks within its type (`.min()`, `.refine()`, `.describe()`).
 */
export type Exact<T, U> = [T] extends [U] ? ([U] extends [T] ? U : never) : never
