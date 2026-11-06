/**
 * `U` when the annotation `T` and the parser type `U` are assignable both ways, otherwise `never`. An export written
 * `export const x: T = parser satisfies Exact<typeof x, typeof parser>` fails tsc when `T` lists fewer or more
 * object keys or enum members than the parser, a looser type or another optionality. A type only, so the check
 * leaves no code behind. It sees zod types, not what a schema of one type checks: `.min()`, `.regex()`,
 * `.refine()`, `.describe()` or `.meta()` leave the type as it is.
 */
export type Exact<T, U> = [T] extends [U] ? ([U] extends [T] ? U : never) : never
