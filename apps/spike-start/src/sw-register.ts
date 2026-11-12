/** Registers this edition's worker for this edition's path only; `onWaiting` gets a new version that waits while another one controls the page (as apps/web/src/components/offline-layer.tsx). */
export function registerWorker(onWaiting: (worker: ServiceWorker) => void) {
  if (!('serviceWorker' in navigator)) return
  const sw = navigator.serviceWorker
  const base = import.meta.env.BASE_URL
  sw.register(`${base}sw.js`, { scope: base, updateViaCache: 'none' }).then(
    (r: ServiceWorkerRegistration | undefined) => {
      if (!r) return
      const check = () => {
        if (r.waiting && sw.controller) onWaiting(r.waiting)
      }
      check()
      r.addEventListener('updatefound', () => r.installing?.addEventListener('statechange', check))
    },
    () => {},
  )
}

/** The notice's Reload: the waiting worker takes over, then this tab reloads once. */
export function takeOver(waiting: ServiceWorker) {
  // already active (Reload in another tab): reload only
  if (waiting.state !== 'installed') return location.reload()
  navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), {
    once: true,
  })
  waiting.postMessage('skip-waiting')
}
