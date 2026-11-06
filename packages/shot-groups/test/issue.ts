import { type Issue, ShotGroupsError } from '../src/issue.ts'

/** The issue `f` refuses with; any other throw, or none, fails the test. */
export function issueOf(f: () => unknown): Issue {
  try {
    f()
  } catch (e) {
    if (e instanceof ShotGroupsError) return e.issue
    throw e
  }
  throw new Error('expected a refusal')
}
