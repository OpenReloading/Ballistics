import { lengthText } from '@rangefoundry/svg-drawings'
import { revolutionVolume } from '@rangefoundry/svg-drawings/bullet'

const halfProfile: [number, number][] = [
  [0, 0],
  [4, 0],
  [4, 10],
  [0, 10],
]

console.log(lengthText(25.4, 'in')) // 1.0000
console.log(revolutionVolume(halfProfile, 10).toFixed(1)) // 502.7
