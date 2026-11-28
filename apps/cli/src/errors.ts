/** Fields an error adds to its JSON object on stderr, next to `kind` and `message`. */
type Details = Record<string, unknown>

/** An error a run ends with on purpose: its `kind` on stderr and its exit code, a subset of BSD `sysexits(3)` plus 1 for a refusal. */
export abstract class ExpectedError extends Error {
  abstract readonly kind: 'usage' | 'data' | 'no-input' | 'refused'
  abstract readonly code: number
  details: Details | undefined
  constructor(message: string, details?: Details) {
    super(message)
    this.details = details
  }
}

/** A command line that does not hold: an unknown option or command, a missing or conflicting argument. Exit code 64. */
export class UsageError extends ExpectedError {
  readonly kind = 'usage'
  readonly code = 64
}

/** A file, body, module or records that do not parse, validate or give what the run needs. Exit code 65. */
export class DataError extends ExpectedError {
  readonly kind = 'data'
  readonly code = 65
}

/** A path that does not exist or cannot be read. Exit code 66. */
export class NoInputError extends ExpectedError {
  readonly kind = 'no-input'
  readonly code = 66
}

/** A run the command refuses by its rules (a sealed split, rows that do not compare, a 422 answer). Exit code 1. */
export class Refusal extends ExpectedError {
  readonly kind = 'refused'
  readonly code = 1
}

/** The exit code of an unexpected error. */
export const internalCode = 70
