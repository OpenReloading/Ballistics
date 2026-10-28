/** Bad input: a rows file, an option, records or a model module. Exit code 2. */
export class UsageError extends Error {}

/** A run the command refuses by its rules (a sealed split, rows that do not compare). Exit code 1. */
export class Refusal extends Error {}
