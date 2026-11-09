import { z } from 'zod'

/** JSON Schema (2020-12, the OpenAPI 3.1 dialect) of one parameter, body or response, as `z.toJSONSchema` writes it, without `$schema`. */
export type JsonSchema = Record<string, unknown>

/** A request schema as its input, a response schema as its output (records are stored parsed). */
export const jsonSchema = (schema: z.ZodType, io: 'input' | 'output' = 'input'): JsonSchema => {
  const { $schema: _, ...rest } = z.toJSONSchema(schema, {
    io,
    unrepresentable: 'any',
    // a number in a query string is parsed from its text, so the document shows the number it must be (zod leaves out the examples of a transformed input; they are the numbers too)
    override: ({ zodSchema, jsonSchema: node }) => {
      // oxlint-disable-next-line no-underscore-dangle -- zod 4 gives a schema's definition only under `_zod`
      const def = zodSchema._zod.def
      const examples = z.globalRegistry.get(zodSchema)?.['examples']
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the examples of the registry are an array
      if (examples) node.examples = examples as unknown[]
      // oxlint-disable-next-line no-underscore-dangle -- zod 4 gives a schema's definition only under `_zod`
      if (io !== 'input' || def.type !== 'pipe' || def.out._zod.def.type !== 'number') return
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the output of a pipe to a number is a zod number
      const number = z.toJSONSchema(def.out as z.ZodType)
      delete number.$schema
      for (const key of Object.keys(node))
        if (key !== 'description' && key !== 'examples') delete node[key]
      Object.assign(node, number)
    },
  })
  return rest
}
