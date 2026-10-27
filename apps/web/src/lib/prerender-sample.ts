/**
 * `PRERENDER=sample` (development, agent builds, pull request builds without record changes) prerenders
 * only the records below on the detail routes; every other id renders on its first visit. Unset or any
 * other value prerenders every record (deploy image, releases, default branch).
 */
export const sampleIds: Record<string, readonly string[]> = {
  // the records the e2e specs and the smoke set open, so their tests meet prerendered pages
  cartridge: [
    '308-win',
    '308-norma-mag',
    '6-5-grendel',
    '22-long-rifle',
    '220-swift',
    '300-weath-mag',
    '454-casull',
    '10-3-capra',
    '12-7-x-108',
    '18-x-81',
    '243-win-super-short-mag',
    '8-x-51-r-lebel',
    // the rest of the default drawing baseline (`common` of drawing-baseline.spec.ts)
    '6-5-creedmoor',
    '284-win',
    '30-30-win',
    '300-win-mag',
    '9-mm-luger',
    '12',
    // the specs of the record page and its drawing text
    '6mm-me-flobert-court',
    '40-x-46-deftec',
    '223-rem',
  ],
  bullet: ['demo-bullet-168', 'demo-bullet-150'],
  powder: ['demo-powder-dp40'],
  case: ['demo-case-308-brass'],
  primer: ['demo-primer-large-rifle', 'demo-primer-small-pistol-lead-free'],
  // a large precision face and a small one
  'target-face': ['issf-25m-precision-50m-pistol', 'bdmp-nr6'],
  // a pistol discipline on two faces and a long gun one
  discipline: ['dsb-25m-pistole-revolver', 'bds-2102'],
  federation: ['dsb'],
}

export function isSampling(env: Record<string, string | undefined> = process.env) {
  return env.PRERENDER === 'sample'
}

/**
 * The ids of `what` (`cartridge`, `bullet`, `powder`, `case`, `primer`, `target-face`, `discipline` or `federation`) to prerender: all of `ids` unless sampling, else
 * those of the sample that exist, or the first id when none does (Cache Components need one per route).
 */
export function pickIds(
  what: string,
  ids: string[],
  env: Record<string, string | undefined> = process.env,
) {
  if (!isSampling(env)) return ids
  const wanted = new Set(sampleIds[what] ?? [])
  const picked = ids.filter((id) => wanted.has(id))
  return picked.length > 0 ? picked : ids.slice(0, 1)
}

/**
 * The ids of `what` the Pages edition prerenders. A page the export leaves out answers 404 and the
 * links to it log that, so the sample cuts the cartridge pages only (about 85 % of the export).
 */
export function exportIds(
  what: string,
  ids: string[],
  env: Record<string, string | undefined> = process.env,
) {
  return what === 'cartridge' ? pickIds(what, ids, env) : ids
}
