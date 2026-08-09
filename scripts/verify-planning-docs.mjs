import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import {
  collectReferenceIds,
  parseIterationTestCases,
  validateIterationState
} from './planning/iteration-model.mjs'

const root = process.cwd()
const errors = []
const missingFiles = new Set()

const globalDocuments = [
  'docs/00-product-charter.md',
  'docs/01-product-requirements.md',
  'docs/02-compatibility-matrix.md',
  'docs/03-architecture.md',
  'docs/04-technology-stack.md',
  'docs/05-data-safety-and-security.md',
  'docs/06-ui-interaction-spec.md',
  'docs/07-iteration-roadmap.md',
  'docs/08-development-plan.md',
  'docs/09-test-strategy.md',
  'docs/10-release-quality-gates.md',
  'docs/11-codex-cli-runbook.md',
  'docs/12-risk-register.md',
  'docs/13-source-baseline.md',
  'docs/14-planning-acceptance.md',
  'docs/15-public-contracts.md',
  'docs/16-project-structure-and-standards.md',
  'docs/17-settings-and-storage-schema.md',
  'docs/18-error-catalog.md',
  'docs/19-user-journeys.md',
  'docs/20-markdown-compatibility-profile.md',
  'docs/21-command-menu-inventory.md'
]

const activeRunbooks = [
  'AGENTS.md',
  'docs/README.md',
  'docs/03-architecture.md',
  'docs/04-technology-stack.md',
  'docs/05-data-safety-and-security.md',
  'docs/06-ui-interaction-spec.md',
  'docs/07-iteration-roadmap.md',
  'docs/08-development-plan.md',
  'docs/09-test-strategy.md',
  'docs/11-codex-cli-runbook.md',
  'docs/14-planning-acceptance.md',
  'docs/15-public-contracts.md',
  'docs/16-project-structure-and-standards.md',
  'docs/17-settings-and-storage-schema.md',
  'docs/18-error-catalog.md'
]

const iterationInfrastructure = [
  'iterations/README.md',
  'iterations/state.json',
  'iterations/state.schema.json',
  'iterations/templates/requirements.md',
  'iterations/templates/detailed-design.md',
  'iterations/templates/test-cases.md',
  'iterations/templates/test-report.md',
  'iterations/templates/exit-report.md'
]

const requiredFiles = [
  '.gitignore',
  'README.md',
  'AGENTS.md',
  'docs/README.md',
  'docs/test-cases/fixture-catalog.md',
  ...globalDocuments,
  ...iterationInfrastructure
]

const requirementSections = [
  'Iteration context',
  'Objectives',
  'User-observable outcomes',
  'Scope',
  'Non-goals',
  'Requirement and compatibility coverage',
  'Preconditions and external dependencies',
  'Risks and mitigations',
  'Iteration-level acceptance criteria',
  'Entry completeness'
]

const detailedDesignSections = [
  'Iteration context',
  'Architecture boundaries',
  'Capability design',
  'Module responsibilities',
  'Interfaces and data flow',
  'Data safety, failure handling, migration, and compatibility constraints',
  'Dependency admission',
  'Manual-gate design',
  'Implementation order'
]

const testCaseSections = [
  'Iteration context',
  'Coverage and ownership',
  'Automated test cases',
  'Manual test cases',
  'Parameter matrix',
  'Fixtures',
  'Evidence requirements',
  'Stop conditions'
]

const testReportSections = [
  'Iteration context',
  'Report status',
  'Baseline and environment',
  'Executed commands and results',
  'Failures, fixes, and regression evidence',
  'Unexecuted verification',
  'Residual risks',
  'Manual-gate handoff',
  'Exit-readiness statement'
]

const exitReportSections = [
  'Iteration context',
  'Requirement completion matrix',
  'Final deliverables',
  'Material implementation and documentation changes',
  'Automated-gate conclusion',
  'Manual-gate conclusion',
  'Known limitations and residual risks',
  'Rollback approach',
  'Inputs released to the next iteration',
  'Final iteration decision'
]

const automationSuiteRoots = new Map([
  ['test', 'tests/unit/'],
  ['test:integration', 'tests/integration/'],
  ['test:e2e', 'tests/e2e/'],
  ['test:security', 'tests/security/'],
  ['test:performance', 'tests/performance/']
])

const testReportStatuses = new Set(['in_progress', 'awaiting_manual', 'passed'])
const automationTargetFileStatuses = new Set(['awaiting_manual', 'passed'])
const requirementPrefixes = new Set(['DOC', 'EDT', 'MD', 'WS', 'IMG', 'EXP', 'UI', 'OS', 'NFR'])

const absolutePath = (relativePath) => path.join(root, relativePath)
const exists = (relativePath) => fs.existsSync(absolutePath(relativePath))

const requireFile = (relativePath) => {
  if (exists(relativePath) || missingFiles.has(relativePath)) return exists(relativePath)
  missingFiles.add(relativePath)
  errors.push(`missing required file: ${relativePath}`)
  return false
}

const read = (relativePath) => {
  if (!requireFile(relativePath)) return null
  try {
    return fs.readFileSync(absolutePath(relativePath), 'utf8')
  } catch (error) {
    errors.push(`cannot read ${relativePath}: ${error.message}`)
    return null
  }
}

const readJson = (relativePath) => {
  const content = read(relativePath)
  if (content === null) return null
  try {
    return JSON.parse(content)
  } catch (error) {
    errors.push(`${relativePath} is invalid JSON: ${error.message}`)
    return null
  }
}

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const hasHeading = (content, heading) =>
  content.split(/\r?\n/).some((line) => line.trim() === `## ${heading}`)

const validateRequiredSections = (relativePath, content, sections) => {
  for (const section of sections) {
    if (!hasHeading(content, section)) {
      errors.push(`${relativePath} is missing required section: ${section}`)
    }
  }
}

const validateResolvedContent = (relativePath, content) => {
  if (/\bTBD\b|待定|\{\{[^}\r\n]+\}\}/i.test(content)) {
    errors.push(`${relativePath} contains unresolved planning content`)
  }
}

const validateBalancedFences = (relativePath, content) => {
  const openFences = []
  for (const line of content.split(/\r?\n/)) {
    const match = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line)
    if (match === null) continue

    const marker = match[1]
    const suffix = match[2].trim()
    const open = openFences.at(-1)
    if (
      open !== undefined &&
      marker[0] === open.marker &&
      marker.length >= open.length &&
      suffix.length === 0
    ) {
      openFences.pop()
    } else if (open === undefined) {
      openFences.push({ marker: marker[0], length: marker.length })
    }
  }

  if (openFences.length > 0) errors.push(`unbalanced fenced code block in ${relativePath}`)
}

const extractLinkTarget = (rawTarget) => {
  let target = rawTarget.trim()
  if (target.startsWith('<')) {
    const closing = target.indexOf('>')
    if (closing === -1) return target
    target = target.slice(1, closing)
  } else {
    target = target.split(/\s+(?=["'])/, 1)[0]
  }
  return target.split('#', 1)[0]
}

const validateLocalLinks = (relativePath, content) => {
  for (const match of content.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const target = extractLinkTarget(match[1])
    if (target.length === 0 || /^[a-z][a-z0-9+.-]*:/i.test(target)) continue

    let decodedTarget
    try {
      decodedTarget = decodeURIComponent(target)
    } catch {
      errors.push(`invalid local link encoding in ${relativePath}: ${match[1]}`)
      continue
    }

    const resolved = path.resolve(root, path.dirname(relativePath), decodedTarget)
    const relativeResolved = path.relative(root, resolved)
    if (relativeResolved.startsWith('..') || path.isAbsolute(relativeResolved)) {
      errors.push(`local link escapes the repository in ${relativePath}: ${match[1]}`)
    } else if (!fs.existsSync(resolved)) {
      errors.push(`broken local link in ${relativePath}: ${match[1]}`)
    }
  }
}

const parseMarkdownTableCells = (line) => {
  const trimmed = line.trim()
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return null
  return trimmed
    .slice(1, -1)
    .split('|')
    .map((cell) => cell.trim())
}

const isContainedPath = (container, candidate) => {
  const relative = path.relative(container, candidate)
  return (
    relative !== '' &&
    !relative.startsWith(`..${path.sep}`) &&
    relative !== '..' &&
    !path.isAbsolute(relative)
  )
}

const validateAutomationTargets = (relativePath, content, requireTargetFiles) => {
  for (const line of content.split(/\r?\n/)) {
    const cells = parseMarkdownTableCells(line)
    if (cells === null || !/^TC-M[0-8]-\d{3}$/.test(cells[0] ?? '')) continue

    const caseId = cells[0]
    const automationCell = cells.at(-1) ?? ''
    const commandMatch = /^`([^`]+)`/.exec(automationCell)
    if (commandMatch === null) {
      errors.push(`${caseId} has ambiguous automation target in ${relativePath}`)
      continue
    }

    const command = commandMatch[1]
    if (command === 'pnpm test:bootstrap:cold') continue
    const targetMatch =
      /^pnpm (test(?::(?:integration|e2e|security|performance))?) -- (tests\/[a-z0-9./-]+\.spec\.tsx?)$/.exec(
        command
      )
    if (targetMatch === null) {
      errors.push(`${caseId} has ambiguous automation target: ${command}`)
      continue
    }

    const [, script, target] = targetMatch
    const suiteRoot = automationSuiteRoots.get(script)
    if (suiteRoot === undefined || !target.startsWith(suiteRoot)) {
      errors.push(`${caseId} automation script/path mismatch: ${command}`)
      continue
    }

    const resolvedTarget = path.resolve(root, target)
    if (!isContainedPath(root, resolvedTarget)) {
      errors.push(`${caseId} automation target escapes repository root: ${target}`)
      continue
    }

    const resolvedSuiteRoot = path.resolve(root, suiteRoot)
    if (!isContainedPath(resolvedSuiteRoot, resolvedTarget)) {
      errors.push(`${caseId} automation target escapes suite root ${suiteRoot}: ${target}`)
      continue
    }
    if (target.split('/').some((segment) => segment === '.' || segment === '..')) {
      errors.push(`${caseId} automation target contains traversal: ${target}`)
      continue
    }

    if (requireTargetFiles) {
      let isRegularFile = false
      try {
        isRegularFile = fs.lstatSync(resolvedTarget).isFile()
      } catch {
        isRegularFile = false
      }
      if (!isRegularFile) {
        errors.push(`${caseId} automation target is not a regular file: ${target}`)
      }
    }
  }
}

const addDefinition = (definitions, id, kind) => {
  if (definitions.has(id)) errors.push(`duplicate ${kind} id: ${id}`)
  definitions.add(id)
}

const compareCoverage = (defined, covered, kind) => {
  for (const id of defined) {
    if (!covered.has(id)) errors.push(`${kind} ${id} is not covered by an iteration`)
  }
  for (const id of covered) {
    if (!defined.has(id)) errors.push(`iteration coverage references unknown ${kind} ${id}`)
  }
}

const validateTaskLevelInstructions = (relativePath, content) => {
  for (const [index, line] of content.split(/\r?\n/).entries()) {
    if (/\bM[0-8]-T\d{2}\b/.test(line)) {
      errors.push(`${relativePath} contains task-level execution instruction at line ${index + 1}`)
    }
    if (/tasks\/state\.json|\bcurrent_task\b/.test(line)) {
      errors.push(`${relativePath} contains obsolete task-state instruction at line ${index + 1}`)
    }
    if (
      /(?:解锁|开启)[^。\r\n]{0,24}(?:任务|子任务)/.test(line) ||
      /\b(?:task|subtask)[ -]?unlock(?:ing)?\b/i.test(line) ||
      /\bunlock(?:s|ed|ing)?\b[^.\r\n]{0,48}\b(?:sub)?tasks?\b/i.test(line)
    ) {
      errors.push(`${relativePath} contains task-unlock execution language at line ${index + 1}`)
    }
  }
}

const hasExactMarkdownTableHeader = (markdown, expectedCells) =>
  markdown.split(/\r?\n/).some((line) => {
    const cells = parseMarkdownTableCells(line)
    return (
      cells !== null &&
      cells.length === expectedCells.length &&
      cells.every((cell, index) => cell === expectedCells[index])
    )
  })

const requireSnippets = (relativePath, snippets) => {
  const content = read(relativePath)
  if (content === null) return
  for (const snippet of snippets) {
    if (!content.includes(snippet)) {
      errors.push(`${relativePath} is missing required planning contract: ${snippet}`)
    }
  }
}

for (const relativePath of requiredFiles) requireFile(relativePath)

const state = readJson('iterations/state.json')
const stateSchema = readJson('iterations/state.schema.json')
if (state !== null && stateSchema !== null) {
  errors.push(...validateIterationState(state, stateSchema))
}

const iterations = isPlainObject(state) && Array.isArray(state.iterations) ? state.iterations : []
const instructionFiles = new Set([
  ...activeRunbooks,
  'iterations/README.md',
  'iterations/state.json',
  'iterations/templates/requirements.md',
  'iterations/templates/detailed-design.md',
  'iterations/templates/test-cases.md',
  'iterations/templates/test-report.md',
  'iterations/templates/exit-report.md'
])
const activeMarkdownFiles = new Set([
  'README.md',
  'AGENTS.md',
  'docs/README.md',
  'docs/test-cases/fixture-catalog.md',
  ...globalDocuments,
  'iterations/README.md'
])
const iterationRequirementContents = []
const globalAutomatedCases = new Set()
const globalManualCases = new Set()
const parsedCasesByIteration = new Map()

for (const iteration of iterations) {
  if (!isPlainObject(iteration) || typeof iteration.id !== 'string') continue
  const entry = isPlainObject(iteration.entry) ? iteration.entry : {}
  const exit = isPlainObject(iteration.exit) ? iteration.exit : {}
  const entryRoles = [
    ['requirements', entry.requirements, requirementSections],
    ['detailed_design', entry.detailed_design, detailedDesignSections],
    ['test_cases', entry.test_cases, testCaseSections]
  ]

  for (const [role, relativePath, sections] of entryRoles) {
    if (typeof relativePath !== 'string') continue
    const content = read(relativePath)
    if (content === null) continue
    activeMarkdownFiles.add(relativePath)
    instructionFiles.add(relativePath)
    validateRequiredSections(relativePath, content, sections)
    validateResolvedContent(relativePath, content)

    if (role === 'requirements') iterationRequirementContents.push(content)
    if (role !== 'test_cases') continue

    const parsed = parseIterationTestCases(content, iteration.id)
    parsedCasesByIteration.set(iteration.id, parsed)
    for (const error of parsed.errors) errors.push(`${relativePath}: ${error}`)
    for (const caseId of parsed.automated) {
      if (globalAutomatedCases.has(caseId) || globalManualCases.has(caseId)) {
        errors.push(`duplicate test case id across iterations: ${caseId}`)
      }
      globalAutomatedCases.add(caseId)
    }
    for (const caseId of parsed.manual) {
      if (globalManualCases.has(caseId) || globalAutomatedCases.has(caseId)) {
        errors.push(`duplicate test case id across iterations: ${caseId}`)
      }
      globalManualCases.add(caseId)
    }
    if (parsed.automated.length === 0) {
      errors.push(`${iteration.id} has no executable TC-* specification`)
    }
    if (iteration.manual_gate === true && parsed.manual.length === 0) {
      errors.push(`${iteration.id} manual gate has no MAN-* specification`)
    }
    validateAutomationTargets(
      relativePath,
      content,
      automationTargetFileStatuses.has(iteration.status)
    )
  }

  const outputRoles = [
    [
      'exit.test_report',
      exit.test_report,
      testReportStatuses.has(iteration.status),
      testReportSections
    ],
    [
      'exit.iteration_report',
      exit.iteration_report,
      iteration.status === 'passed',
      exitReportSections
    ]
  ]
  for (const [role, relativePath, requiredForStatus, sections] of outputRoles) {
    if (typeof relativePath !== 'string') continue
    if (requiredForStatus && !exists(relativePath)) {
      errors.push(`${iteration.id} status ${iteration.status} requires ${role}: ${relativePath}`)
      continue
    }
    if (!requiredForStatus && exists(relativePath)) {
      errors.push(
        `${iteration.id} status ${iteration.status} must not create ${role}: ${relativePath}`
      )
      continue
    }
    if (!exists(relativePath)) continue

    const content = read(relativePath)
    if (content === null) continue
    activeMarkdownFiles.add(relativePath)
    validateRequiredSections(relativePath, content, sections)
    validateResolvedContent(relativePath, content)
  }
}

const productRequirements = read('docs/01-product-requirements.md')
const definedRequirements = new Set()
if (productRequirements !== null) {
  for (const match of productRequirements.matchAll(/^\s*-\s+\*\*([A-Z][A-Z0-9]*-\d{3})\b/gm)) {
    const id = match[1]
    if (requirementPrefixes.has(id.split('-', 1)[0])) {
      addDefinition(definedRequirements, id, 'requirement')
    }
  }
}
const iterationRequirementText = iterationRequirementContents.join('\n')
const coveredRequirements = collectReferenceIds(iterationRequirementText, requirementPrefixes)
compareCoverage(definedRequirements, coveredRequirements, 'requirement')

const compatibilityMatrix = read('docs/02-compatibility-matrix.md')
const definedCompatibility = new Set()
if (compatibilityMatrix !== null) {
  for (const match of compatibilityMatrix.matchAll(/^\|\s*(COMP-\d{3})\s*\|/gm)) {
    addDefinition(definedCompatibility, match[1], 'compatibility item')
  }
}
const coveredCompatibility = collectReferenceIds(iterationRequirementText, new Set(['COMP']))
compareCoverage(definedCompatibility, coveredCompatibility, 'compatibility item')

const technologyTableHeaderCells = [
  '依赖',
  '用途',
  '许可证',
  '原生二进制',
  '安装脚本',
  '替代方案',
  '包体影响'
]
const technologyStack = read('docs/04-technology-stack.md')
if (
  technologyStack !== null &&
  !hasExactMarkdownTableHeader(technologyStack, technologyTableHeaderCells)
) {
  errors.push(
    'docs/04-technology-stack.md is missing the required technology dependency table header'
  )
}

const pandocContracts = new Map([
  ['docs/02-compatibility-matrix.md', ['EXP-005,007,009', 'IMP-001..030']],
  ['docs/03-architecture.md', ['Pandoc 导入是独立的只读源转换', '不创建部分会话']],
  ['docs/05-data-safety-and-security.md', ['Pandoc 导入只读源文件', 'staging']],
  [
    'docs/15-public-contracts.md',
    [
      'interface ImportAdapter',
      'interface ImportedDocument',
      'stagingId',
      'file.new/open/openFolder/import'
    ]
  ],
  ['docs/17-settings-and-storage-schema.md', ['interface RecoveryMetaV2', 'importStagingId']],
  [
    'docs/18-error-catalog.md',
    ['IMPORT_UNSUPPORTED_FORMAT', 'IMPORT_OUTPUT_INVALID', 'IMPORT_FAILED']
  ],
  ['docs/19-user-journeys.md', ['## J-013 Pandoc 导入', '源文件哈希始终不变']],
  ['docs/21-command-menu-inventory.md', ['`file.import`', 'Pandoc 缺失']],
  ['iterations/M6-export/01-requirements.md', ['EXP-005, EXP-007, EXP-009', 'Pandoc', 'staging']],
  ['iterations/M6-export/02-detailed-design.md', ['shell:false', 'staging', 'unnamed session']],
  ['iterations/M6-export/03-test-cases.md', ['TC-M6-010', 'PANDOCIMPORT-M6', 'MAN-M6-002']]
])
for (const [relativePath, snippets] of pandocContracts) requireSnippets(relativePath, snippets)

const m6 = iterations.find((iteration) => isPlainObject(iteration) && iteration.id === 'M6')
const m6Requirements = read('iterations/M6-export/01-requirements.md')
if (
  m6Requirements !== null &&
  !collectReferenceIds(m6Requirements, requirementPrefixes).has('EXP-009')
) {
  errors.push('M6 requirements must own EXP-009')
}
const m6Cases = parsedCasesByIteration.get('M6')
if (m6Cases !== undefined && !m6Cases.automated.includes('TC-M6-010')) {
  errors.push('M6 must own TC-M6-010 for Pandoc import')
}
if (m6Cases !== undefined && !m6Cases.manual.includes('MAN-M6-002')) {
  errors.push('M6 must own MAN-M6-002 for Pandoc import/export verification')
}
if (!isPlainObject(m6) || m6.manual_gate !== true) {
  errors.push('M6 must remain a manual-gate iteration for Pandoc import/export verification')
}

for (const relativePath of instructionFiles) {
  const content = read(relativePath)
  if (content !== null) validateTaskLevelInstructions(relativePath, content)
}

for (const relativePath of activeMarkdownFiles) {
  const content = read(relativePath)
  if (content === null) continue
  validateBalancedFences(relativePath, content)
  validateLocalLinks(relativePath, content)
}

const docsIndex = read('docs/README.md')
if (docsIndex !== null) {
  for (const relativePath of globalDocuments) {
    const filename = path.basename(relativePath)
    if (!docsIndex.includes(`](${filename})`)) {
      errors.push(`docs/README.md does not link ${filename}`)
    }
  }
}

const agents = read('AGENTS.md')
if (agents !== null) {
  const agentsBytes = Buffer.byteLength(agents, 'utf8')
  if (agentsBytes >= 32_768) {
    errors.push(`AGENTS.md must stay below the Codex 32 KiB instruction limit: ${agentsBytes}`)
  }
}

if (errors.length > 0) {
  console.error(`Planning documentation verification failed with ${errors.length} error(s):`)
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log(
  `Planning documentation verified: ${iterations.length} iterations, ${globalAutomatedCases.size} automated test cases, ${globalManualCases.size} manual cases, ${definedRequirements.size} requirements, ${definedCompatibility.size} compatibility items.`
)
