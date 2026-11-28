// Replaces the service worker an earlier edition registered at this URL (also served as next/sw.js): it deletes that worker's caches and unregisters, so returning visitors load the site from the network.

// only this site's caches: the origin also serves the other project sites of the account
const ownCache = (name) => /^(next:)?rangefoundry-/.test(name)

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys()
      await Promise.all(names.filter(ownCache).map((name) => caches.delete(name)))
      await self.registration.unregister()
    })(),
  )
})
