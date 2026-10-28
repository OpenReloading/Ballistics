import { z } from 'zod'

/** The fields every 200 compute answer carries, which say what produced it (`routes/identity.ts`). */
export const identity = {
  inputHash: z
    .string()
    .describe(
      'SHA-256 of the request as 64 hex digits: the canonical JSON of the body (keys sorted, as sent, defaults not filled in), of the query for a request without a body, of `{ body, query }` where a request has both.',
    ),
  apiVersion: z.string().describe('Version of the API that computed the answer.'),
  dataHash: z
    .string()
    .describe(
      'SHA-256 of the data set the API ran on (every record and the renames) as 64 hex digits. It changes with any record field.',
    ),
}
