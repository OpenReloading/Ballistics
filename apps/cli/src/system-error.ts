/** The `code` of a Node.js system error, such as `ENOENT`; undefined for any other thrown value. */
export const systemErrorCode = (error: unknown): string | undefined =>
  error instanceof Error && 'code' in error && typeof error.code === 'string'
    ? error.code
    : undefined
