import { lstat, readFile, readdir, realpath } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const expectedWorkflowFiles = ['codeql.yml', 'dependency-review.yml', 'quality.yml']
const expectedDependencyReviewLicenses = new Set([
  '0BSD',
  'Apache-2.0',
  'BlueOak-1.0.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'ISC',
  'MIT',
  'Python-2.0',
  'WTFPL'
])
const allowedActions = new Map([
  ['actions/checkout', '3d3c42e5aac5ba805825da76410c181273ba90b1'],
  ['actions/setup-node', '820762786026740c76f36085b0efc47a31fe5020'],
  ['actions/upload-artifact', '043fb46d1a93c77aae656e7c1c64a875d1fc6a0a'],
  ['github/codeql-action/init', 'f205ea1c3313d32999d8d6a48b4f6530d4437b38'],
  ['github/codeql-action/autobuild', 'f205ea1c3313d32999d8d6a48b4f6530d4437b38'],
  ['github/codeql-action/analyze', 'f205ea1c3313d32999d8d6a48b4f6530d4437b38'],
  ['actions/dependency-review-action', 'a1d282b36b6f3519aa1f3fc636f609c47dddb294']
])

const requiredQualityCommands = [
  'corepack install --global pnpm@11.12.0',
  'pnpm install --frozen-lockfile',
  'node scripts/verify-planning-docs.mjs',
  'pnpm check',
  'pnpm test:e2e',
  'pnpm test:security',
  'pnpm package:win',
  'pnpm test:packaged',
  'pnpm audit:m0'
]

const expectedPermissions = new Map([
  ['quality.yml', new Map([['contents', 'read']])],
  [
    'codeql.yml',
    new Map([
      ['contents', 'read'],
      ['packages', 'read'],
      ['security-events', 'write']
    ])
  ],
  [
    'dependency-review.yml',
    new Map([
      ['contents', 'read'],
      ['pull-requests', 'read']
    ])
  ]
])

function fail(code) {
  throw new Error(code)
}

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0
}

async function readRegularFile(path, code) {
  const status = await lstat(path).catch(() => undefined)
  if (status === undefined || !status.isFile() || status.isSymbolicLink()) {
    fail(code)
  }
  return readFile(path, 'utf8')
}

function parseUses(source) {
  const actionReferences = []
  for (const line of source.split(/\r?\n/)) {
    if (!line.includes('uses:')) continue
    const match = line.match(/^\s+(?:-\s+)?uses:\s+([^\s#]+)(?:\s+#.*)?$/)
    if (match?.[1] === undefined) {
      fail('M0_WORKFLOW_ACTION_INVALID')
    }
    const reference = match[1]
    const separator = reference.lastIndexOf('@')
    if (separator < 1) {
      fail('M0_WORKFLOW_ACTION_NOT_PINNED')
    }
    const action = reference.slice(0, separator)
    const sha = reference.slice(separator + 1)
    if (!/^[0-9a-f]{40}$/.test(sha)) {
      fail('M0_WORKFLOW_ACTION_NOT_PINNED')
    }
    if (allowedActions.get(action) !== sha) {
      fail('M0_WORKFLOW_ACTION_NOT_APPROVED')
    }
    actionReferences.push(action)
  }
  return actionReferences
}

function parseRootPermissions(source) {
  const lines = source.split(/\r?\n/)
  const permissionIndexes = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => /^permissions:\s*$/.test(line))
  if (permissionIndexes.length !== 1) {
    fail('M0_WORKFLOW_PERMISSION_NOT_ALLOWED')
  }
  const start = permissionIndexes[0]?.index
  if (start === undefined) fail('M0_WORKFLOW_PERMISSION_NOT_ALLOWED')
  const permissions = new Map()
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index]
    if (line === undefined || line.trim().length === 0 || line.trimStart().startsWith('#')) continue
    if (!/^\s/.test(line)) break
    const match = line.match(/^\s{2}([a-z-]+):\s+(read|write|none)\s*$/)
    if (match?.[1] === undefined || match[2] === undefined || permissions.has(match[1])) {
      fail('M0_WORKFLOW_PERMISSION_NOT_ALLOWED')
    }
    permissions.set(match[1], match[2])
  }
  return permissions
}

function assertExactPermissions(fileName, source) {
  const expected = expectedPermissions.get(fileName)
  if (expected === undefined) fail('M0_WORKFLOW_PERMISSION_NOT_ALLOWED')
  const actual = parseRootPermissions(source)
  if (
    actual.size !== expected.size ||
    [...expected].some(([key, value]) => actual.get(key) !== value)
  ) {
    fail('M0_WORKFLOW_PERMISSION_NOT_ALLOWED')
  }
}

function assertQualityContract(source) {
  if (!source.includes('pnpm install --frozen-lockfile')) {
    fail('M0_WORKFLOW_FROZEN_INSTALL_REQUIRED')
  }
  const runCommands = new Set(
    source
      .split(/\r?\n/)
      .map((line) => line.trim())
      .flatMap((line) => {
        const match = line.match(/^(?:-\s+)?run:\s+(.+)$/)
        return match?.[1] === undefined ? [] : [match[1]]
      })
  )
  for (const command of requiredQualityCommands) {
    if (!runCommands.has(command)) {
      fail('M0_WORKFLOW_COMMAND_PARITY')
    }
  }
  const pathLines = source
    .split(/\r?\n/)
    .filter((line) => /^\s+path:\s*/.test(line))
    .map((line) => line.trim())
  if (pathLines.length !== 1 || pathLines[0] !== 'path: artifacts/m0') {
    fail('M0_WORKFLOW_ARTIFACT_PATH_NOT_ALLOWED')
  }
  if (!/^\s+retention-days:\s+14\s*$/m.test(source) || !/^\s+if:\s+always\(\)\s*$/m.test(source)) {
    fail('M0_WORKFLOW_ARTIFACT_POLICY_INVALID')
  }
}

function assertWorkflowSafety(source) {
  if (/^\s*pull_request_target\s*:/m.test(source)) {
    fail('M0_WORKFLOW_TRIGGER_NOT_ALLOWED')
  }
  if (/\bwhile\s*\(|\bfor\s*\(\s*;\s*;/i.test(source)) {
    fail('M0_WORKFLOW_UNBOUNDED_LOOP')
  }
  if (/\b(?:curl|wget|Invoke-WebRequest|Invoke-RestMethod)\b/i.test(source)) {
    fail('M0_WORKFLOW_UNAPPROVED_DOWNLOAD')
  }
}

function assertCodeqlContract(source) {
  if (!source.includes("cron: '17 3 * * 1'")) fail('M0_WORKFLOW_CODEQL_POLICY_INVALID')
  for (const action of [
    'github/codeql-action/init',
    'github/codeql-action/autobuild',
    'github/codeql-action/analyze'
  ]) {
    if (!source.includes(`uses: ${action}@${allowedActions.get(action)}`)) {
      fail('M0_WORKFLOW_CODEQL_POLICY_INVALID')
    }
  }
  if (!/^\s+languages:\s+javascript-typescript\s*$/m.test(source)) {
    fail('M0_WORKFLOW_CODEQL_POLICY_INVALID')
  }
}

function assertDependencyReviewContract(source) {
  if (!/^\s+fail-on-severity:\s+moderate\s*$/m.test(source)) {
    fail('M0_WORKFLOW_DEPENDENCY_REVIEW_POLICY_INVALID')
  }
  if (/^\s+(?:allow-dependencies-licenses|warn-only):/m.test(source)) {
    fail('M0_WORKFLOW_DEPENDENCY_REVIEW_POLICY_INVALID')
  }
  const licenseLines = [...source.matchAll(/^\s+allow-licenses:\s+(.+)\s*$/gm)]
  const licenseSource = licenseLines[0]?.[1]
  if (licenseLines.length !== 1 || licenseSource === undefined) {
    fail('M0_WORKFLOW_DEPENDENCY_REVIEW_POLICY_INVALID')
  }
  const licenses = licenseSource.split(',').map((license) => license.trim())
  if (
    licenses.some((license) => license.length === 0) ||
    new Set(licenses).size !== licenses.length ||
    licenses.length !== expectedDependencyReviewLicenses.size ||
    licenses.some((license) => !expectedDependencyReviewLicenses.has(license))
  ) {
    fail('M0_WORKFLOW_DEPENDENCY_REVIEW_POLICY_INVALID')
  }
}

function assertDependabotContract(source) {
  if (!/^version:\s+2\s*$/m.test(source)) fail('M0_DEPENDABOT_POLICY_INVALID')
  const ecosystems = [...source.matchAll(/^\s+- package-ecosystem:\s+([^\s]+)\s*$/gm)].map(
    (match) => match[1]
  )
  if (
    ecosystems.length !== 2 ||
    !ecosystems.includes('pnpm') ||
    !ecosystems.includes('github-actions')
  ) {
    fail('M0_DEPENDABOT_POLICY_INVALID')
  }
  for (const pattern of [
    /^\s+directory:\s+\/\s*$/gm,
    /^\s+target-branch:\s+main\s*$/gm,
    /^\s+interval:\s+weekly\s*$/gm,
    /^\s+day:\s+monday\s*$/gm,
    /^\s+time:\s+'04:17'\s*$/gm,
    /^\s+timezone:\s+Asia\/Shanghai\s*$/gm,
    /^\s+open-pull-requests-limit:\s+5\s*$/gm
  ]) {
    if ([...source.matchAll(pattern)].length !== 2) fail('M0_DEPENDABOT_POLICY_INVALID')
  }
  if (/auto-?merge/i.test(source)) fail('M0_DEPENDABOT_POLICY_INVALID')
}

export async function verifyWorkflows(options) {
  const rootDirectory = await realpath(resolve(options.rootDirectory))
  const workflowDirectory = join(rootDirectory, '.github', 'workflows')
  const entries = await readdir(workflowDirectory, { withFileTypes: true }).catch(() => undefined)
  if (entries === undefined) fail('M0_WORKFLOW_SET_INVALID')
  const workflowFiles = entries
    .filter((entry) => entry.name.endsWith('.yml') || entry.name.endsWith('.yaml'))
    .map((entry) => entry.name)
    .sort(compareStrings)
  if (
    workflowFiles.length !== expectedWorkflowFiles.length ||
    workflowFiles.some((name, index) => name !== expectedWorkflowFiles[index])
  ) {
    fail('M0_WORKFLOW_SET_INVALID')
  }

  let pinnedActionCount = 0
  for (const fileName of workflowFiles) {
    const source = await readRegularFile(
      join(workflowDirectory, fileName),
      'M0_WORKFLOW_FILE_INVALID'
    )
    assertWorkflowSafety(source)
    assertExactPermissions(fileName, source)
    pinnedActionCount += parseUses(source).length
    if (fileName === 'quality.yml') assertQualityContract(source)
    if (fileName === 'codeql.yml') assertCodeqlContract(source)
    if (fileName === 'dependency-review.yml') assertDependencyReviewContract(source)
  }

  const dependabotSource = await readRegularFile(
    join(rootDirectory, '.github', 'dependabot.yml'),
    'M0_DEPENDABOT_POLICY_INVALID'
  )
  assertDependabotContract(dependabotSource)
  return {
    workflowCount: workflowFiles.length,
    pinnedActionCount,
    dependabotConfigured: true
  }
}

async function main() {
  const result = await verifyWorkflows({ rootDirectory: process.cwd() })
  process.stdout.write(
    `GitHub automation verified: ${result.workflowCount} workflows, ${result.pinnedActionCount} pinned actions.\n`
  )
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : 'M0_WORKFLOW_UNKNOWN_FAILURE'}\n`
    )
    process.exitCode = 1
  })
}
