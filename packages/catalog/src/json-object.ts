/** Whether `v` is a JSON object (or an array), whose properties a check may read. */
export const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null
