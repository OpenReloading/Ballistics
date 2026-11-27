import { parseRef, toSi, units } from '@rangefoundry/schema'

console.log(units.pressure) // bar
console.log(toSi('pressure', 3800)) // 380000000
console.log(parseRef('catalogue:308-winchester')) // { scope: 'catalogue', id: '308-winchester' }

const bullet = await import('@rangefoundry/schema/json-schema/bullet.schema.json', {
  with: { type: 'json' },
})
console.log(bullet.default.$schema) // https://json-schema.org/draft/2020-12/schema
