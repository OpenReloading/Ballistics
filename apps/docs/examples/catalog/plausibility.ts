import bundle from '@rangefoundry/catalog/bundle.json' with { type: 'json' }
import { twistPlausible } from '@rangefoundry/catalog/plausibility'

console.log(bundle.cartridges.length > 0) // true
console.log(twistPlausible(254)) // true
