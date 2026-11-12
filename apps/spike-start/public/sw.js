// spike worker: one cache per edition, named with the edition's prefix; the stable worker leaves /next/ alone
const scope = new URL(self.registration.scope).pathname
const prefix = scope.endsWith('/next/') ? 'next:' : ''
const cache = `${prefix}spike-shell-v1`
self.addEventListener('install', (e) => e.waitUntil(caches.open(cache).then((c) => c.add(scope))))
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))
self.addEventListener('fetch', (e) => {
  const path = new URL(e.request.url).pathname
  if (!prefix && path.startsWith('/next/')) return
})
