/** `next/font/local` in the Start build: fonts.css holds the `@font-face` rules and sets `variable` on the class this returns (`--font-drawing` gives `font-drawing`). */
export default function localFont({ variable }: { variable: string }) {
  return { variable: variable.replace(/^--/, '') }
}
