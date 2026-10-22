// The result every chronograph parser returns, and the options they share.
import type { ChronoSession, ChronoShot, QuantityValue } from '@openreloading/schema'
import type { ChronoFormatId } from './index.ts'
import { namedByCaller, parseVelocityUnit, type VelocityUnit } from './units.ts'

export type { ChronoFormatId }

/** Options every chronograph parser takes. */
export interface ChronoParserOptions {
  /** Unit for velocities whose unit the file does not name or names in an unknown way. */
  velocityUnit?: VelocityUnit
  /** File name, used as the provenance source title. */
  fileName?: string
  /** Lowercase hex sha256 of the file bytes, computed by the caller. */
  sha256?: string
}

/** The parts of a `ChronoSession` a file can supply. */
export interface SessionCandidate {
  date?: string
  device: { kind: ChronoSession['device']['kind']; manufacturerName?: string; model?: string }
  muzzleDistance?: QuantityValue
  strings: { shots: ChronoShot[] }[]
  note?: string
  provenance: { kind: 'measured'; sources: [{ title?: string; sha256?: string; note?: string }] }
}

/**
 * Result of a chronograph import: the session the file supplies, a label per string, the units
 * found and what the user still has to enter.
 */
export interface ChronoImport {
  format: ChronoFormatId
  session: SessionCandidate
  /** One label per string (session name, Notes text, series number), offered for choosing its load. */
  stringLabels: (string | undefined)[]
  /** Distinct units of the velocities in first-seen order: named in the file, or by the caller. */
  velocityUnits: { unit: VelocityUnit; source: 'file' | 'caller' }[]
  /**
   * Dot paths the user should enter: the ones `chronoSession` requires, plus `device.firmware`
   * and, for optical devices, `muzzleDistance`.
   */
  missingPaths: string[]
  warnings: string[]
}

type Source = SessionCandidate['provenance']['sources'][0]

/** The sha256 lowercase; throws unless it is 64 hex digits. */
export function checkSha256(sha256: string): string {
  const lower = sha256.toLowerCase()
  if (!/^[0-9a-f]{64}$/.test(lower)) throw new Error('sha256 must be 64 hex digits')
  return lower
}

// assumed small-arms range, not a cited bound: it flags unit, column and footer-row errors only
const minVelocity = 30
const maxVelocity = 2000

/** File name, hash and, when a velocity unit named by the caller was used, a note saying so. */
function provenanceSource(options: ChronoParserOptions, warnings: string[]): Source {
  const source: Source = {}
  if (options.fileName) source.title = options.fileName
  if (options.sha256) source.sha256 = checkSha256(options.sha256)
  // raw keeps only the file's text, so the record states the unit the user named
  const unit = options.velocityUnit
  if (unit && warnings.some((w) => w.endsWith(namedByCaller(unit)))) {
    source.note = `velocities without a known unit in the file are read as ${unit}, as named by the user at import`
  }
  return source
}

/** One warning per string listing the shots outside the assumed small-arms range. */
function rangeWarnings(strings: { shots: ChronoShot[] }[], warnings: string[]): void {
  strings.forEach((s, i) => {
    const out = s.shots.flatMap((shot, j) =>
      shot.velocity.value < minVelocity || shot.velocity.value > maxVelocity ? [j + 1] : [],
    )
    if (out.length > 0) {
      warnings.push(
        `string ${i + 1}: shots ${out.join(', ')} outside ${minVelocity} to ${maxVelocity} m/s; check the unit, the column and statistics rows`,
      )
    }
  })
}

/** Distinct units of the shots in first-seen order; `raw` ends in the file's unit text whenever the file names one. */
function velocityUnitsOf(
  strings: { shots: ChronoShot[] }[],
  callerUnit: VelocityUnit | undefined,
): ChronoImport['velocityUnits'] {
  const velocityUnits: ChronoImport['velocityUnits'] = []
  for (const shot of strings.flatMap((s) => s.shots)) {
    const named = parseVelocityUnit(shot.velocity.raw?.split(' ').at(-1))
    const entry = named
      ? { unit: named, source: 'file' as const }
      : callerUnit && { unit: callerUnit, source: 'caller' as const }
    if (entry && !velocityUnits.some((e) => e.unit === entry.unit && e.source === entry.source)) {
      velocityUnits.push(entry)
    }
  }
  return velocityUnits
}

/** Dot paths of what the file could not supply, in the order the user enters them. */
function missingPaths(session: Omit<SessionCandidate, 'provenance'>, source: Source): string[] {
  const missing = ['id']
  if (!session.date) missing.push('date')
  if (!session.device.manufacturerName) missing.push('device.manufacturerName')
  if (!session.device.model) missing.push('device.model')
  missing.push('device.firmware')
  // the chronograph protocol asks for the screen distance; the schema keeps it optional
  if (session.device.kind === 'optical' && !session.muzzleDistance) missing.push('muzzleDistance')
  missing.push('conditions.airTemperature')
  session.strings.forEach((_, i) => {
    missing.push(`strings.${i}.load`)
  })
  if (!source.title) missing.push('provenance.sources.0.title')
  return missing
}

/** Assembles the result and lists every field the file could not supply. */
export function buildChronoImport(
  format: ChronoFormatId,
  session: Omit<SessionCandidate, 'provenance'>,
  labels: (string | undefined)[],
  warnings: string[],
  options: ChronoParserOptions,
): ChronoImport {
  if (session.strings.length === 0) throw new Error('no shots found')
  const source = provenanceSource(options, warnings)
  rangeWarnings(session.strings, warnings)
  return {
    format,
    session: { ...session, provenance: { kind: 'measured', sources: [source] } },
    stringLabels: labels,
    velocityUnits: velocityUnitsOf(session.strings, options.velocityUnit),
    missingPaths: missingPaths(session, source),
    warnings,
  }
}
