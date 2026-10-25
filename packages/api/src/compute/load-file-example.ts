import { type userDataFile, userDataFormat, userDataVersion } from '@openreloading/schema'
import type { z } from 'zod'

/** A body of `POST /interior/load-file` as a client sends it, before defaults. */
interface LoadFileRequest extends z.input<typeof userDataFile> {}

/** A valid `POST /interior/load-file` body: one workbench load with its typed values in stored units and no records. */
export const loadFileExample: LoadFileRequest = {
  format: userDataFormat,
  version: userDataVersion,
  records: [
    {
      kind: 'load',
      id: 'load-1',
      name: 'Load',
      saved: '2026-01-01T00:00:00.000Z',
      data: {
        origin: 'user',
        charge: { value: 2.8 },
        analysis: {
          overrides: {
            volume: 3.4,
            boreDiameter: 7.82,
            boreArea: 47.5,
            travel: 600,
            twist: 305,
            bulletMass: 10.9,
            propellantEnergy: 4e6,
            gamma: 1.22,
            density: 1.6,
            covolume: 0.000983,
            vivacity: 0.59,
            exponent: 1,
            referencePressure: 0.980665,
            propellantTemperature: 21,
            ignitionPressure: 50,
            startPressure: 100,
          },
        },
      },
    },
  ],
}
