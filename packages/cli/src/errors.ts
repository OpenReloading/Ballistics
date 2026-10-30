/** Fields an error adds to its JSON object on stderr, next to `kind` and `message`. */
type Details = Record<string, unknown>

/** Bad input: a rows file, an option, records, a model module or an operation body. Exit code 2. */
export class UsageError extends Error {
  details: Details | undefined
  constructor(message: string, details?: Details) {
    super(message)
    this.details = details
  }
}

/** A run the command refuses by its rules (a sealed split, rows that do not compare, a 422 answer). Exit code 1. */
export class Refusal extends Error {
  details: Details | undefined
  constructor(message: string, details?: Details) {
    super(message)
    this.details = details
  }
}
