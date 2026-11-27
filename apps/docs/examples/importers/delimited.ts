import { parseDelimited } from '@rangefoundry/importers'

const result = parseDelimited('2800\n2810\n2795', {
  columns: { velocity: 1 },
  velocityUnit: 'ft/s',
})
const [string] = result.session.strings

console.log(string?.shots.map((shot) => shot.velocity.value)) // [ 853.44, 856.488, 851.916 ]
