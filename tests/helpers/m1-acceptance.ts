import { createHash, randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export const m1AcceptanceScenarioIds = [
  'ime-composition',
  'byte-roundtrip',
  'conflict-compare-cancel',
  'conflict-reload',
  'conflict-save-as',
  'conflict-confirmed-overwrite',
  'crash-recovery',
  'close-save',
  'close-discard',
  'close-cancel',
  'reference-evidence'
] as const

export type M1AcceptanceScenarioId = (typeof m1AcceptanceScenarioIds)[number]

export interface M1ByteFixture {
  readonly id: string
  readonly fileName: string
  readonly encoding: string
  readonly eolProfile: string
  readonly baselineBase64: string
  readonly expectedBase64: string
  readonly baselineSha256: string
  readonly expectedSha256: string
  readonly editable: boolean
}

interface M1AcceptanceEnvironment {
  readonly [name: string]: string
}

interface M1EvidenceHash {
  readonly label: string
  readonly sha256: string
}

interface M1ScenarioEvidence {
  readonly fixtureIds?: readonly string[]
  readonly hashes?: readonly M1EvidenceHash[]
  readonly references?: readonly string[]
  readonly components?: readonly string[]
}

interface M1AcceptanceRecorder {
  recordPassed(id: M1AcceptanceScenarioId, evidence?: M1ScenarioEvidence): void
  write(): Promise<string>
}

const expectedFixtureIds = [
  'empty',
  'utf8-lf',
  'utf8-crlf',
  'utf8-no-final-eol',
  'utf8-bom-crlf',
  'utf16le-bom-lf',
  'utf16be-bom-crlf',
  'utf8-mixed-eol',
  'invalid-utf8-readonly'
] as const

const referenceCoverage = [
  { reference: 'REF-001', component: 'COMP-001' },
  { reference: 'REF-002', component: 'COMP-002' },
  { reference: 'REF-003', component: 'COMP-003' },
  { reference: 'REF-004', component: 'COMP-004' },
  { reference: 'REF-005', component: 'COMP-036' }
] as const

const sha256Pattern = /^[a-f0-9]{64}$/
const identifierPattern = /^(?:REF|COMP)-\d{3}$|^[a-z0-9][a-z0-9._-]{0,79}$/

export function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requiredString(record: Record<string, unknown>, key: string): string {
  const value = record[key]
  if (typeof value !== 'string') throw new Error(`M1 fixture ${key} must be a string`)
  return value
}

function parseFixture(value: unknown): M1ByteFixture {
  if (!isRecord(value)) throw new Error('M1 fixture entry must be an object')
  const editable = value.editable
  if (typeof editable !== 'boolean') throw new Error('M1 fixture editable must be boolean')
  const fixture: M1ByteFixture = {
    id: requiredString(value, 'id'),
    fileName: requiredString(value, 'fileName'),
    encoding: requiredString(value, 'encoding'),
    eolProfile: requiredString(value, 'eolProfile'),
    baselineBase64: requiredString(value, 'baselineBase64'),
    expectedBase64: requiredString(value, 'expectedBase64'),
    baselineSha256: requiredString(value, 'baselineSha256'),
    expectedSha256: requiredString(value, 'expectedSha256'),
    editable
  }
  for (const side of ['baseline', 'expected'] as const) {
    const encoded = side === 'baseline' ? fixture.baselineBase64 : fixture.expectedBase64
    const expectedHash = side === 'baseline' ? fixture.baselineSha256 : fixture.expectedSha256
    if (!sha256Pattern.test(expectedHash)) {
      throw new Error(`${fixture.id} ${side}Sha256 must be a lowercase SHA-256`)
    }
    const bytes = Buffer.from(encoded, 'base64')
    if (bytes.toString('base64') !== encoded || sha256(bytes) !== expectedHash) {
      throw new Error(`${fixture.id} ${side}Sha256 does not match Base64 bytes`)
    }
  }
  return Object.freeze(fixture)
}

export async function loadM1ByteFixtures(rootDirectory: string): Promise<readonly M1ByteFixture[]> {
  const manifestPath = join(rootDirectory, 'tests', 'fixtures', 'bytes', 'm1-byte-fixtures.json')
  const parsed: unknown = JSON.parse(await readFile(manifestPath, 'utf8'))
  if (!isRecord(parsed) || parsed.schemaVersion !== 1 || !Array.isArray(parsed.fixtures)) {
    throw new Error('M1 byte fixture manifest must use schemaVersion 1')
  }
  const fixtures = parsed.fixtures.map(parseFixture)
  if (
    fixtures.length !== expectedFixtureIds.length ||
    fixtures.some((fixture, index) => fixture.id !== expectedFixtureIds[index])
  ) {
    throw new Error(`M1 byte fixture IDs must be exactly: ${expectedFixtureIds.join(', ')}`)
  }
  if (new Set(fixtures.map((fixture) => fixture.fileName)).size !== fixtures.length) {
    throw new Error('M1 byte fixture fileName values must be unique')
  }
  return Object.freeze(fixtures)
}

function validateIdentifiers(
  values: readonly string[] | undefined,
  label: string
): readonly string[] {
  const result = values ?? []
  if (result.some((value) => !identifierPattern.test(value))) {
    throw new Error(`M1 acceptance ${label} contains an invalid identifier`)
  }
  return [...result]
}

export function createM1AcceptanceRecorder(options: {
  readonly rootDirectory: string
  readonly environment: M1AcceptanceEnvironment
}): M1AcceptanceRecorder {
  const scenarios = new Map<M1AcceptanceScenarioId, object>()

  return {
    recordPassed(id, evidence = {}) {
      if (!m1AcceptanceScenarioIds.includes(id)) throw new Error(`unknown scenario: ${id}`)
      if (scenarios.has(id)) throw new Error(`duplicate scenario: ${id}`)
      const hashes = (evidence.hashes ?? []).map((hash) => {
        if (!identifierPattern.test(hash.label) || !sha256Pattern.test(hash.sha256)) {
          throw new Error(`invalid SHA-256 evidence for ${id}`)
        }
        return { label: hash.label, sha256: hash.sha256 }
      })
      scenarios.set(id, {
        id,
        result: 'passed',
        fixtureIds: validateIdentifiers(evidence.fixtureIds, 'fixtureIds'),
        hashes,
        references: validateIdentifiers(evidence.references, 'references'),
        components: validateIdentifiers(evidence.components, 'components')
      })
    },
    async write() {
      const missing = m1AcceptanceScenarioIds.filter((id) => !scenarios.has(id))
      if (missing.length > 0) throw new Error(`missing scenarios: ${missing.join(', ')}`)
      const directory = join(options.rootDirectory, 'artifacts', 'm1', 'automated')
      const outputPath = join(directory, 'acceptance.json')
      const temporaryPath = join(directory, `.acceptance-${randomUUID()}.tmp`)
      await mkdir(directory, { recursive: true })
      const document = {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        environment: { ...options.environment },
        referenceCoverage,
        scenarios: m1AcceptanceScenarioIds.map((id) => scenarios.get(id))
      }
      await writeFile(temporaryPath, `${JSON.stringify(document, null, 2)}\n`, {
        encoding: 'utf8',
        flag: 'wx'
      })
      await rename(temporaryPath, outputPath)
      return outputPath
    }
  }
}
