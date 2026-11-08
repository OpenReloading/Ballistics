import { type ChronoDiagnostic, ReaderError } from '../src/diagnostics.ts'

/** The diagnostic `read` refuses with; anything else it throws, or a read without a refusal, fails the test. */
export function refusal(read: () => unknown): ChronoDiagnostic {
  try {
    read()
  } catch (e) {
    if (e instanceof ReaderError) return e.diagnostic
    throw e
  }
  throw new Error('read without a refusal')
}
