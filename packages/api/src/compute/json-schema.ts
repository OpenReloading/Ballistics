import { z } from 'zod'

/** JSON Schema (2020-12, the OpenAPI 3.1 dialect) of one parameter, body or response, as `z.toJSONSchema` writes it, without `$schema`. */
export type JsonSchema = Record<string, unknown>

/** A request schema as its input, a response schema as its output (records are stored parsed). */
export const jsonSchema = (schema: z.ZodType, io: 'input' | 'output' = 'input'): JsonSchema => {
  const { $schema: _, ...rest } = z.toJSONSchema(schema, {
    io,
    unrepresentable: 'any',
    // a number in a query string is parsed from its text, the document shows the number it must be
    // (zod leaves out the examples of a transformed input; they are the numbers too)
    override: ({ zodSchema, jsonSchema }) => {
      const def = zodSchema._zod.def
      const examples = z.globalRegistry.get(zodSchema)?.examples
      if (examples) jsonSchema.examples = examples as unknown[]
      if (io !== 'input' || def.type !== 'pipe' || def.out._zod.def.type !== 'number') return
      const { $schema: _, ...number } = z.toJSONSchema(def.out as z.ZodType)
      for (const key of Object.keys(jsonSchema))
        if (key !== 'description' && key !== 'examples') delete jsonSchema[key]
      Object.assign(jsonSchema, number)
    },
  })
  return rest
}
