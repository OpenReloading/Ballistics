/** `staticFetch` in the server edition, which never calls it: `next.config.ts` aliases `static-api.ts` here. */
export function staticFetch(): Promise<Response> {
  throw new Error('the server edition reads the API')
}
