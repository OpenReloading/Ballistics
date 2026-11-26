/** `localStorage` key of the development hole model's folder (`apps/docs/docs/models/hole-detection.md`, "Learned detector in the app"). */
const devModelKey = 'holeModelFolder'

/** The folder's URL, absolute against the page's address; absent when none is set or storage refuses. */
export function devModelFolder(): string | undefined {
  let folder: string | null
  try {
    folder = localStorage.getItem(devModelKey)
  } catch {
    return undefined
  }
  return folder ? new URL(folder, location.href).href : undefined
}
