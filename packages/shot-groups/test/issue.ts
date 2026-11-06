import { InputError } from '@open-reloading/statistics'
import type { Issue } from '../src/issue.ts'

/** The issue `f` refuses with; any other throw, or none, fails the test. */
export function issueOf(f: () => unknown): Issue {
  try {
    f()
  } catch (e) {
    if (e instanceof InputError && e.issue) return e.issue as Issue
    throw e
  }
  throw new Error('expected a refusal')
}
