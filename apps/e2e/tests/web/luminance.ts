/** Whether a computed `rgb(...)` color looks dark: its relative luminance below middle grey (0.18). */
export function isDark(color: string): boolean {
  const [r = 0, g = 0, b = 0] = (color.match(/[\d.]+/g) ?? []).map(Number)
  const linear = (c: number) => {
    const s = c / 255
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b) < 0.18
}
