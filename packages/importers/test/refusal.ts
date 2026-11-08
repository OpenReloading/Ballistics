import { ReaderError } from '../src/diagnostics.ts'

/** The diagnostic `read` refuses with; anything else it throws, or a read without a refusal, fails the test. */
export function refusal(read: () => unknown): ReaderError['diagnostic'] {
  try {
    read()
  } catch (e) {
    if (e instanceof ReaderError) return e.diagnostic
    throw e
  }
  throw new Error('read without a refusal')
}

/** The diagnostic `read` rejects with; any other rejection, or a read that resolves, fails the test. */
export async function rejection(read: Promise<unknown>): Promise<ReaderError['diagnostic']> {
  try {
    await read
  } catch (e) {
    if (e instanceof ReaderError) return e.diagnostic
    throw e
  }
  throw new Error('read without a refusal')
}
