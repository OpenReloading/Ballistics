// The target faces of packages/catalog/records/target-faces with the abbreviation of their federation, as the app lists them.
import { readdirSync, readFileSync } from 'node:fs'
import type { Federation, TargetFace } from '@rangefoundry/schema'
import { type Face, withOrganization } from '../src/lib/face-organization.ts'

const dir = new URL('../../../packages/catalog/records/target-faces/', import.meta.url)
const federationDir = new URL('../../../packages/catalog/records/federations/', import.meta.url)
const federations = readdirSync(federationDir).map(
  (f) => JSON.parse(readFileSync(new URL(f, federationDir), 'utf8')) as Federation,
)
export const faces: Face[] = readdirSync(dir)
  .sort()
  .map((f) =>
    withOrganization(JSON.parse(readFileSync(new URL(f, dir), 'utf8')) as TargetFace, federations),
  )
export const faceById = (id: string) => {
  const f = faces.find((x) => x.id === id)
  if (!f) throw new Error(`No face ${id}`)
  return f
}
