import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

it('the cleanup worker activates at once, deletes the caches of both editions and unregisters', async () => {
  const listeners = new Map<string, (event: { waitUntil: (p: Promise<unknown>) => void }) => void>()
  const names = [
    'rangefoundry-shell-abc',
    'rangefoundry-records',
    'next:rangefoundry-shell-def',
    'next:rangefoundry-records',
    'other-site-cache',
  ]
  const deleted: string[] = []
  const steps: string[] = []
  const self = {
    addEventListener: (type: string, listener: never) => listeners.set(type, listener),
    skipWaiting: () => steps.push('skipWaiting'),
    registration: { unregister: async () => steps.push('unregister') },
  }
  const caches = {
    keys: async () => names,
    delete: async (name: string) => deleted.push(name),
  }
  const source = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8')
  new Function('self', 'caches', source)(self, caches)

  listeners.get('install')?.({ waitUntil: () => undefined })
  let activated: Promise<unknown> = Promise.resolve()
  listeners.get('activate')?.({ waitUntil: (p) => (activated = p) })
  await activated

  expect(deleted).toEqual([
    'rangefoundry-shell-abc',
    'rangefoundry-records',
    'next:rangefoundry-shell-def',
    'next:rangefoundry-records',
  ])
  expect(steps).toEqual(['skipWaiting', 'unregister'])
})
