type Schema = Record<string, unknown>

/** Paths of the JSON Schema properties without a non-empty description, at any depth of `schema`: under `properties`, `items`, `additionalProperties`, `anyOf`, `oneOf`, `allOf` and `prefixItems`. */
export function undescribed(schema: unknown, path = ''): string[] {
  if (!schema || typeof schema !== 'object') return []
  const s = schema as Schema
  const own = Object.entries((s['properties'] ?? {}) as Record<string, Schema>).flatMap(
    ([key, value]) => {
      const at = `${path}.${key}`
      const missing =
        typeof value['description'] === 'string' && value['description'].trim() !== '' ? [] : [at]
      return [...missing, ...undescribed(value, at)]
    },
  )
  const nested = ['items', 'additionalProperties'].flatMap((k) => undescribed(s[k], `${path}[]`))
  const lists = ['anyOf', 'oneOf', 'allOf', 'prefixItems'].flatMap((k) =>
    ((s[k] ?? []) as unknown[]).flatMap((x, i) => undescribed(x, `${path}<${k}${i}>`)),
  )
  return [...own, ...nested, ...lists]
}
