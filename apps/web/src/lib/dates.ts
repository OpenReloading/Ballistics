/** The local calendar day of `d` as YYYY-MM-DD: the date of a print or a file name. */
export const localDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const dayFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

/** A YYYY-MM-DD day as text ("1 May 2026"), the same on server and browser; any other text as given. */
export const dayText = (day: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(day) && !Number.isNaN(Date.parse(day))
    ? dayFormat.format(new Date(day))
    : day
