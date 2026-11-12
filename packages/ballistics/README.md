# @open-reloading/ballistics

The ballistics models in SI: the M3 interior model with its load records and load files, the charge solver, tolerance ranges, ladders, the Monte Carlo band, recoil, the powder and pressure-curve fits and the advisory registry; the ICAO standard atmosphere and measured air, the G1 to GS drag tables with their interpolation and the drag estimate from a bullet outline, the point mass and modified point mass trajectory with its zero, gyroscopic stability, spin drift and aerodynamic jump, the truing of the muzzle velocity and drag, range strings, and the RK45 integrator they run on. An input check throws `InputError` with a typed issue `{ code, params }` (`BallisticsIssue`) and no text, so the caller words it in its language; a load file value it refuses is a `ValueError` that names its field, and pressure rows of a fit on more than one basis a `MixedPressureBasisError` with their counts. It depends on `@open-reloading/units` and `@rangefoundry/statistics` only. Private to this repository: it is not published.

```js
import { millerStability, speedOfSound, standardAtmosphere } from '@open-reloading/ballistics'

const air = standardAtmosphere(0)
speedOfSound(air) // 340.29... (m/s)
// a 175 gr .308 bullet of 1.35 in at 2800 ft/s from a 1:10 in twist
millerStability({ mass: 0.01134, diameter: 0.00782, length: 0.0343, twist: 0.254, velocity: 853, air }) // 1.92...
```

License: MIT
