/** Registers this edition's worker for this edition's path only. */
export function registerWorker() {
  if (!('serviceWorker' in navigator)) return
  const base = import.meta.env.BASE_URL
  void navigator.serviceWorker.register(`${base}sw.js`, { scope: base })
}
