/** The message of a thrown value: an `Error`'s message, else the value as text. */
export const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e))
