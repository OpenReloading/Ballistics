/** Text a spreadsheet would read as a formula gets a leading apostrophe; numbers stay numbers. */
const plain = (text: string) =>
  /^[=+\-@\t\r]/.test(text) && !Number.isFinite(Number(text)) ? `'${text}` : text
const cell = (raw: string) => {
  const text = plain(raw)
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}
const row = (cells: (string | number)[]) => cells.map((c) => cell(String(c))).join(',')

/** CSV text of `rows`, one line each; formula-like text gets a leading apostrophe. */
export const toCsv = (rows: (string | number)[][]) => rows.map(row).join('\n')
