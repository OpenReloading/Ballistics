// One labeler's Label Studio JSON export of a project with the labeling config scripts/label-studio.xml to a label set: node scripts/label-studio.mts <export.json> <labels.json>
import { readFileSync, writeFileSync } from 'node:fs'
import { z } from 'zod'
import { type LabeledPhoto, type LabelSet, labelSet } from '../src/index.ts'

const result = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('keypointlabels'),
    id: z.string(),
    original_width: z.number(),
    original_height: z.number(),
    image_rotation: z.literal(0).optional(),
    value: z.object({ x: z.number(), y: z.number() }),
  }),
  z.object({
    type: z.literal('choices'),
    id: z.string(),
    from_name: z.string(),
    value: z.object({ choices: z.array(z.string()) }),
  }),
])

const task = z.object({
  data: z.object({
    file: z.string(),
    sha256: z.string(),
    source: z.string(),
    license: z.string(),
    author: z.string(),
    session: z.string(),
    width: z.number(),
    height: z.number(),
    visibleDiameterPx: z.number(),
  }),
  // one labeler per export, so one annotation per task
  annotations: z.tuple([z.object({ result: z.array(result) })]),
})

function photoOf({ data, annotations: [{ result: results }] }: z.infer<typeof task>) {
  const { file, width, height, ...facts } = data
  const choices = results.filter((r) => r.type === 'choices')
  const choice = (name: string) => {
    const picked = choices.find((c) => c.from_name === name)?.value.choices[0]
    if (picked === undefined) throw new Error(`${file}: no ${name} choice`)
    return picked
  }
  const flag = (name: string) => {
    const picked = choice(name)
    if (picked !== 'yes' && picked !== 'no')
      throw new Error(`${file}: ${name} is ${picked}, not yes or no`)
    return picked === 'yes'
  }
  const uncertain = new Set(
    choices
      .filter((c) => c.from_name === 'uncertain')
      .map((c) => {
        const [picked] = c.value.choices
        if (picked !== 'uncertain')
          throw new Error(`${file}: uncertain is ${picked}, not uncertain`)
        return c.id
      }),
  )
  const photo: LabeledPhoto = {
    ...facts,
    kind: choice('kind'),
    usable: flag('usable'),
    complete: flag('complete'),
    size: [width, height],
    // Label Studio gives keypoints in percent of the image
    holes: results
      .filter((r) => r.type === 'keypointlabels')
      .map((k) => {
        if (k.original_width !== width || k.original_height !== height)
          throw new Error(
            `${file}: Label Studio shows it as ${k.original_width} x ${k.original_height} px`,
          )
        return {
          x: (k.value.x / 100) * width,
          y: (k.value.y / 100) * height,
          uncertain: uncertain.has(k.id),
        }
      }),
  }
  return [file, photo] as const
}

/** The label set of a parsed Label Studio export. */
export function fromLabelStudio(exported: unknown): LabelSet {
  const tasks = z.array(task).parse(exported)
  const photos = Object.fromEntries(tasks.map(photoOf))
  if (Object.keys(photos).length !== tasks.length) throw new Error('the export holds a file twice')
  return labelSet.parse({ photos })
}

if (import.meta.main) {
  const [from, to] = process.argv.slice(2)
  if (!from || !to) {
    console.error('usage: label-studio.mts <export.json> <labels.json>')
    process.exit(2)
  }
  const set = fromLabelStudio(JSON.parse(readFileSync(from, 'utf8')))
  writeFileSync(to, `${JSON.stringify(set, null, 2)}\n`)
}
