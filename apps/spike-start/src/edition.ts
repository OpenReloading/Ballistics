/** `'next'` in the next edition (built with `VITE_EDITION=next` under `/next/`), else `''`: stable at the root. */
export const edition = import.meta.env.VITE_EDITION === 'next' ? 'next' : ''

/** A storage key, database or cache name of this edition: both editions share one origin. */
export const storageName = (name: string) => (edition ? `${edition}:${name}` : name)
