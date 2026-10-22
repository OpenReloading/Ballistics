import { type userDataFile, userDataFormat, userDataVersion } from '@openreloading/schema'
import type { z } from 'zod'

/** A body of `POST /interior/load-file` as a client sends it, before defaults. */
interface LoadFileRequest extends z.input<typeof userDataFile> {}

/** A valid `POST /interior/load-file` body: one workbench load with SI values and no records. */
export const loadFileExample: LoadFileRequest = {
  format: userDataFormat,
  version: userDataVersion,
  records: [
    {
      kind: 'workbenchState',
      id: 'load-1',
      name: 'Load',
      saved: '2026-01-01T00:00:00.000Z',
      data: {
        siValues: {
          volume: 3.4e-6,
          boreDiameter: 7.82e-3,
          boreArea: 4.75e-5,
          travel: 0.6,
          twist: 0.305,
          bulletMass: 0.0109,
          charge: 0.0028,
          propellantEnergy: 4e6,
          gamma: 1.22,
          density: 1600,
          covolume: 0.000983,
          vivacity: 0.59,
          exponent: 1,
          referencePressure: 98066.5,
          propellantTemperature: 294.15,
          ignitionPressure: 5e6,
          startPressure: 1e7,
        },
      },
    },
  ],
}
