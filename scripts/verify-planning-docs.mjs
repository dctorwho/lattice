import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const errors = []
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8')
const exists = (relative) => fs.existsSync(path.join(root, relative))
const reportErrorsAndExit = () => {
  console.error(`Planning documentation verification failed with ${errors.length} error(s):`)
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

const requiredFiles = [
  '.gitignore',
  'README.md',
  'AGENTS.md',
  'docs/README.md',
  ...Array.from({ length: 13 }, (_, index) => {
    const number = String(index).padStart(2, '0')
    const names = {
      '00': 'product-charter',
      '01': 'product-requirements',
      '02': 'compatibility-matrix',
      '03': 'architecture',
      '04': 'technology-stack',
      '05': 'data-safety-and-security',
      '06': 'ui-interaction-spec',
      '07': 'iteration-roadmap',
      '08': 'development-plan',
      '09': 'test-strategy',
      '10': 'release-quality-gates',
      '11': 'codex-cli-runbook',
      '12': 'risk-register'
    }
    return `docs/${number}-${names[number]}.md`
  }),
  'docs/13-source-baseline.md',
  'docs/14-planning-acceptance.md',
  'docs/15-public-contracts.md',
  'docs/16-project-structure-and-standards.md',
  'docs/17-settings-and-storage-schema.md',
  'docs/18-error-catalog.md',
  'docs/19-user-journeys.md',
  'docs/20-markdown-compatibility-profile.md',
  'docs/21-command-menu-inventory.md',
  'docs/test-cases/README.md',
  'docs/test-cases/fixture-catalog.md',
  'docs/test-cases/M0-foundation.md',
  'docs/test-cases/M1-document-core.md',
  'docs/test-cases/M2-hybrid-editor.md',
  'docs/test-cases/M3-workspace-shell.md',
  'docs/test-cases/M4-advanced-markdown.md',
  'docs/test-cases/M5-media-theme.md',
  'docs/test-cases/M6-export.md',
  'docs/test-cases/M7-parity-hardening.md',
  'docs/test-cases/M8-windows-release.md',
  'tasks/README.md',
  'tasks/TASK_TEMPLATE.md',
  'tasks/state.json',
  'tasks/state.schema.json',
  ...Array.from({ length: 9 }, (_, index) => {
    const files = [
      'M0-foundation.md',
      'M1-document-core.md',
      'M2-hybrid-editor.md',
      'M3-workspace-shell.md',
      'M4-advanced-markdown.md',
      'M5-media-theme.md',
      'M6-export.md',
      'M7-parity-hardening.md',
      'M8-windows-release.md'
    ]
    return `tasks/${files[index]}`
  })
]

for (const file of requiredFiles) {
  if (!exists(file)) errors.push(`missing required file: ${file}`)
}

let state
let stateSchema
try {
  state = JSON.parse(read('tasks/state.json'))
} catch (error) {
  errors.push(`tasks/state.json is invalid JSON: ${error.message}`)
  state = { tasks: [], allowed_statuses: [] }
}
try {
  stateSchema = JSON.parse(read('tasks/state.schema.json'))
} catch (error) {
  errors.push(`tasks/state.schema.json is invalid JSON: ${error.message}`)
  stateSchema = { required: [], properties: {} }
}

function isRfc3339DateTime(value) {
  if (typeof value !== 'string') return false
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-](\d{2}):(\d{2}))$/.exec(value)
  if (!match) return false

  const [, yearText, monthText, dayText, hourText, minuteText, secondText, zone, offsetHourText, offsetMinuteText] = match
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const hour = Number(hourText)
  const minute = Number(minuteText)
  const second = Number(secondText)
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth[month - 1]) return false
  if (hour > 23 || minute > 59 || second > 60) return false
  if (zone !== 'Z' && (Number(offsetHourText) > 23 || Number(offsetMinuteText) > 59)) return false
  return true
}

function validateStateAgainstSchema(value, schema) {
  const validationErrorStart = errors.length
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push('tasks/state.json must be an object')
    return false
  }

  const allowedTopLevel = new Set(Object.keys(schema.properties ?? {}))
  for (const key of Object.keys(value)) {
    if (!allowedTopLevel.has(key)) errors.push(`tasks/state.json has unsupported property: ${key}`)
  }
  for (const key of schema.required ?? []) {
    if (!(key in value)) errors.push(`tasks/state.json is missing required property: ${key}`)
  }
  if (value.schema_version !== schema.properties?.schema_version?.const) {
    errors.push(`tasks/state.json schema_version must be ${schema.properties?.schema_version?.const}`)
  }
  if (typeof value.product_baseline !== 'string' || value.product_baseline.length === 0) {
    errors.push('tasks/state.json product_baseline must be a non-empty string')
  }
  const milestonePattern = new RegExp(schema.properties?.current_milestone?.pattern ?? '^$')
  if (typeof value.current_milestone !== 'string' || !milestonePattern.test(value.current_milestone)) {
    errors.push(`tasks/state.json has invalid current_milestone: ${value.current_milestone}`)
  }
  const taskIdPattern = new RegExp(
    schema.properties?.current_task?.oneOf?.find((item) => item.type === 'string')?.pattern ?? '^$'
  )
  if (value.current_task !== null &&
      (typeof value.current_task !== 'string' || !taskIdPattern.test(value.current_task))) {
    errors.push(`tasks/state.json has invalid current_task: ${value.current_task}`)
  }

  const statusEnum = new Set(schema.properties?.allowed_statuses?.items?.enum ?? [])
  if (!Array.isArray(value.allowed_statuses) ||
      new Set(value.allowed_statuses).size !== value.allowed_statuses.length ||
      value.allowed_statuses.some((status) => !statusEnum.has(status))) {
    errors.push('tasks/state.json allowed_statuses violates state.schema.json')
  }
  if (!Array.isArray(value.tasks) || value.tasks.length === 0) {
    errors.push('tasks/state.json tasks must be a non-empty array')
    return false
  }

  const taskSchema = schema.properties?.tasks?.items ?? {}
  const taskKeys = new Set(Object.keys(taskSchema.properties ?? {}))
  const taskRequired = taskSchema.required ?? []
  const evidenceSchema = taskSchema.properties?.evidence?.items ?? {}
  const evidenceKeys = new Set(Object.keys(evidenceSchema.properties ?? {}))
  const evidenceKinds = new Set(evidenceSchema.properties?.kind?.enum ?? [])
  for (const [index, task] of value.tasks.entries()) {
    if (!task || typeof task !== 'object' || Array.isArray(task)) {
      errors.push(`tasks/state.json tasks[${index}] must be an object`)
      continue
    }
    for (const key of Object.keys(task)) {
      if (!taskKeys.has(key)) errors.push(`${task.id ?? `tasks[${index}]`} has unsupported property: ${key}`)
    }
    for (const key of taskRequired) {
      if (!(key in task)) errors.push(`${task.id ?? `tasks[${index}]`} is missing required property: ${key}`)
    }
    if (typeof task.id !== 'string' || !taskIdPattern.test(task.id)) {
      errors.push(`tasks/state.json has invalid task id at index ${index}: ${task.id}`)
    }
    if (!statusEnum.has(task.status)) errors.push(`${task.id} has schema-invalid status: ${task.status}`)
    if (!Array.isArray(task.depends_on) || new Set(task.depends_on).size !== task.depends_on.length ||
        task.depends_on.some((dependency) => typeof dependency !== 'string' || !taskIdPattern.test(dependency))) {
      errors.push(`${task.id} has schema-invalid depends_on`)
    }
    if (typeof task.manual_gate !== 'boolean') errors.push(`${task.id} manual_gate must be boolean`)
    if (!Array.isArray(task.evidence)) {
      errors.push(`${task.id} evidence must be an array`)
      continue
    }
    for (const [evidenceIndex, evidence] of task.evidence.entries()) {
      if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) {
        errors.push(`${task.id} evidence[${evidenceIndex}] must be an object`)
        continue
      }
      for (const key of Object.keys(evidence)) {
        if (!evidenceKeys.has(key)) errors.push(`${task.id} evidence[${evidenceIndex}] has unsupported property: ${key}`)
      }
      for (const key of evidenceSchema.required ?? []) {
        if (!(key in evidence)) errors.push(`${task.id} evidence[${evidenceIndex}] is missing ${key}`)
      }
      if (!evidenceKinds.has(evidence.kind)) errors.push(`${task.id} evidence[${evidenceIndex}] has invalid kind`)
      if (typeof evidence.summary !== 'string' || evidence.summary.length === 0) {
        errors.push(`${task.id} evidence[${evidenceIndex}] summary must be non-empty`)
      }
      if (evidence.path !== undefined && typeof evidence.path !== 'string') {
        errors.push(`${task.id} evidence[${evidenceIndex}] path must be a string`)
      }
      if (!isRfc3339DateTime(evidence.recorded_at)) {
        errors.push(`${task.id} evidence[${evidenceIndex}] recorded_at must be an RFC 3339 date-time`)
      }
    }
  }
  return errors.length === validationErrorStart
}

const stateIsSchemaValid = validateStateAgainstSchema(state, stateSchema)
if (!stateIsSchemaValid || requiredFiles.some((file) => !exists(file))) reportErrorsAndExit()

const tasks = state.tasks ?? []
if (tasks.length < 77) errors.push(`planning baseline requires at least 77 tasks, found ${tasks.length}`)
const ids = new Set()
for (const task of tasks) {
  if (ids.has(task.id)) errors.push(`duplicate task id: ${task.id}`)
  ids.add(task.id)
  if (!state.allowed_statuses.includes(task.status)) {
    errors.push(`invalid status for ${task.id}: ${task.status}`)
  }
}
for (const task of tasks) {
  for (const dependency of task.depends_on ?? []) {
    if (!ids.has(dependency)) errors.push(`${task.id} depends on unknown task ${dependency}`)
    if (dependency === task.id) errors.push(`${task.id} depends on itself`)
  }
}

const visiting = new Set()
const visited = new Set()
const byId = new Map(tasks.map((task) => [task.id, task]))
function visit(id, trail = []) {
  if (visiting.has(id)) {
    errors.push(`dependency cycle: ${[...trail, id].join(' -> ')}`)
    return
  }
  if (visited.has(id)) return
  visiting.add(id)
  for (const dependency of byId.get(id)?.depends_on ?? []) visit(dependency, [...trail, id])
  visiting.delete(id)
  visited.add(id)
}
for (const id of ids) visit(id)

const milestoneFiles = requiredFiles.filter((file) => /^tasks\/M\d-/.test(file))
const taskDocs = milestoneFiles.map((file) => read(file)).join('\n')
const taskSections = new Map()
const documentedTaskIds = new Set(
  [...taskDocs.matchAll(/^## (M\d-T\d{2})\b/gm)].map((match) => match[1])
)
for (const id of ids) {
  if (!documentedTaskIds.has(id)) errors.push(`task ${id} has no task specification heading`)
}
for (const id of documentedTaskIds) {
  if (!ids.has(id)) errors.push(`documented task ${id} is missing from state.json`)
}

for (const file of milestoneFiles) {
  const content = read(file)
  const headings = [...content.matchAll(/^## (M\d-T\d{2})\b/gm)]
  for (let index = 0; index < headings.length; index += 1) {
    const heading = headings[index]
    const section = content.slice(heading.index, headings[index + 1]?.index ?? content.length)
    const id = heading[1]
    taskSections.set(id, section)
    if (!/依赖[：:]/.test(section)) errors.push(`${id} has no dependency declaration`)
    if (!/交付[：:]/.test(section)) errors.push(`${id} has no deliverable declaration`)
    if (!/验证[：:]/.test(section)) errors.push(`${id} has no verification declaration`)
    if (byId.get(id)?.manual_gate && !/人工/.test(section)) {
      errors.push(`${id} requires a manual gate but its specification has no manual verification`)
    }

    const dependencyLine = section.split(/\r?\n/).find((line) => /^- 依赖[：:]/.test(line))
    const documentedDependencies = dependencyLine?.match(/M\d-T\d{2}/g) ?? []
    const stateDependencies = byId.get(id)?.depends_on ?? []
    if (dependencyLine?.includes('无') && documentedDependencies.length > 0) {
      errors.push(`${id} dependency declaration mixes 无 with task IDs`)
    }
    if ([...documentedDependencies].sort().join(',') !== [...stateDependencies].sort().join(',')) {
      errors.push(
        `${id} dependency mismatch: docs=[${documentedDependencies.join(', ')}], state=[${stateDependencies.join(', ')}]`
      )
    }

    for (const line of section.split(/\r?\n/).filter((value) => value.includes('解锁'))) {
      const mentionedTaskIds = [...line.matchAll(/M\d-T\d{2}/g)].map((match) => match[0])
      const directSuccessors = new Set(
        tasks.filter((task) => (task.depends_on ?? []).includes(id)).map((task) => task.id)
      )
      for (const mentionedTaskId of mentionedTaskIds) {
        if (!directSuccessors.has(mentionedTaskId)) {
          errors.push(`${id} claims to unlock non-direct successor ${mentionedTaskId}`)
        }
      }
    }
  }
}

const testCaseFiles = requiredFiles.filter((file) => /^docs\/test-cases\/M\d-/.test(file))
const automatedCases = new Map()
const manualCases = new Map()
const taskToAutomatedCases = new Map(tasks.map((task) => [task.id, []]))
const taskToManualCases = new Map(tasks.map((task) => [task.id, []]))
const automationSuiteRoots = new Map([
  ['test', 'tests/unit/'],
  ['test:integration', 'tests/integration/'],
  ['test:e2e', 'tests/e2e/'],
  ['test:security', 'tests/security/'],
  ['test:performance', 'tests/performance/'],
  ['test:bootstrap:cold', 'tests/bootstrap/']
])
const automationTargetPattern =
  /^`pnpm (test(?::(?:integration|e2e|security|performance|bootstrap:cold))?) -- (tests\/[a-z0-9./-]+\.spec\.ts)`$/
const coldBootstrapTarget = '`pnpm test:bootstrap:cold`'
const parseAutomationTarget = (target) => {
  if (target === coldBootstrapTarget) return ['test:bootstrap:cold', 'tests/bootstrap/']
  return target.match(automationTargetPattern)?.slice(1) ?? null
}
const coldBootstrapMatch = parseAutomationTarget(coldBootstrapTarget)
if (!coldBootstrapMatch || !coldBootstrapMatch[1].startsWith(automationSuiteRoots.get(coldBootstrapMatch[0]))) {
  errors.push('planning verifier does not recognize the TC-M0-008 cold-bootstrap automation target')
}

for (const file of testCaseFiles) {
  const content = read(file)
  const milestone = path.basename(file).match(/^(M\d)-/)?.[1]
  for (const heading of ['## 自动化与半自动用例', '## 参数矩阵', '## 人工门禁', '## 证据与停止条件']) {
    if (!content.includes(heading)) errors.push(`${file} is missing required section: ${heading}`)
  }
  if (/\bTBD\b|待定/i.test(content)) errors.push(`${file} contains unresolved TBD/待定 content`)

  for (const match of content.matchAll(/^(\| (TC-(M\d)-\d{3}) \| (M\d-T\d{2}) \|.*)$/gm)) {
    const [, row, caseId, caseMilestone, taskId] = match
    if (automatedCases.has(caseId) || manualCases.has(caseId)) errors.push(`duplicate test case id: ${caseId}`)
    automatedCases.set(caseId, { file, taskId, row })
    if (!ids.has(taskId)) errors.push(`${caseId} references unknown task ${taskId}`)
    if (caseMilestone !== milestone || !taskId.startsWith(`${milestone}-`)) {
      errors.push(`${caseId} milestone/task mismatch in ${file}: ${taskId}`)
    }
    taskToAutomatedCases.get(taskId)?.push(caseId)
    const cells = row.split('|').map((value) => value.trim()).filter(Boolean)
    if (cells.length < 7) errors.push(`${caseId} does not contain all required table fields`)
    const automationTarget = cells[6] ?? ''
    const targetMatch = parseAutomationTarget(automationTarget)
    if (!targetMatch) {
      errors.push(`${caseId} has ambiguous automation target: ${automationTarget}`)
    } else if (!targetMatch[1].startsWith(automationSuiteRoots.get(targetMatch[0]))) {
      errors.push(`${caseId} automation script/path mismatch: ${automationTarget}`)
    }
  }

  for (const match of content.matchAll(/^(\| (MAN-(M\d)-\d{3}) \| (M\d-T\d{2}) \|.*)$/gm)) {
    const [, row, caseId, caseMilestone, taskId] = match
    if (manualCases.has(caseId) || automatedCases.has(caseId)) errors.push(`duplicate test case id: ${caseId}`)
    manualCases.set(caseId, { file, taskId, row })
    if (!ids.has(taskId)) errors.push(`${caseId} references unknown task ${taskId}`)
    if (caseMilestone !== milestone || !taskId.startsWith(`${milestone}-`)) {
      errors.push(`${caseId} milestone/task mismatch in ${file}: ${taskId}`)
    }
    taskToManualCases.get(taskId)?.push(caseId)
    const cells = row.split('|').map((value) => value.trim()).filter(Boolean)
    if (cells.length < 6) errors.push(`${caseId} does not contain all required manual table fields`)
  }
}

for (const task of tasks) {
  if ((taskToAutomatedCases.get(task.id) ?? []).length === 0) {
    errors.push(`task ${task.id} has no executable TC-* specification`)
  }
  if (task.manual_gate && (taskToManualCases.get(task.id) ?? []).length === 0) {
    errors.push(`manual-gate task ${task.id} has no MAN-* specification`)
  }
  if (!task.manual_gate && (taskToManualCases.get(task.id) ?? []).length > 0) {
    errors.push(`task ${task.id} owns MAN-* specifications but manual_gate is false`)
  }
}

if (automatedCases.size < 85) {
  errors.push(`planning baseline requires at least 85 automated cases, found ${automatedCases.size}`)
}
if (manualCases.size < 13) {
  errors.push(`planning baseline requires at least 13 manual cases, found ${manualCases.size}`)
}

for (const file of milestoneFiles) {
  const milestoneName = path.basename(file)
  const expectedTestFile = `../docs/test-cases/${milestoneName}`
  if (!read(file).includes(expectedTestFile)) {
    errors.push(`${file} does not link its iteration test specification ${expectedTestFile}`)
  }
}

function expandReferences(text, prefixFilter) {
  const found = new Set()
  const pattern = /\b([A-Z]+)-(\d{3})(?:\.\.([A-Z]+-)?(\d{3}))?\b/g
  for (const match of text.matchAll(pattern)) {
    const prefix = match[1]
    if (prefixFilter && !prefixFilter.has(prefix)) continue
    const start = Number(match[2])
    const end = match[4] ? Number(match[4]) : start
    const endPrefix = match[3] ? match[3].slice(0, -1) : prefix
    if (endPrefix !== prefix || end < start || end - start > 500) {
      errors.push(`invalid reference range: ${match[0]}`)
      continue
    }
    for (let value = start; value <= end; value += 1) {
      found.add(`${prefix}-${String(value).padStart(3, '0')}`)
    }
  }
  return found
}

const requirementsText = read('docs/01-product-requirements.md')
const requirementPrefixes = new Set(['DOC', 'EDT', 'MD', 'WS', 'IMG', 'EXP', 'UI', 'OS', 'NFR'])
const definedRequirements = new Set(
  [...requirementsText.matchAll(/\*\*([A-Z]+-\d{3})\b/g)]
    .map((match) => match[1])
    .filter((id) => requirementPrefixes.has(id.split('-')[0]))
)
if (definedRequirements.size < 83) {
  errors.push(`planning baseline requires at least 83 requirements, found ${definedRequirements.size}`)
}
if (!definedRequirements.has('EXP-009')) {
  errors.push('missing EXP-009 Pandoc import requirement')
}
const taskRequirementRefs = expandReferences(taskDocs, requirementPrefixes)
for (const id of definedRequirements) {
  if (!taskRequirementRefs.has(id)) errors.push(`requirement ${id} is not referenced by a task`)
}

const matrixText = read('docs/02-compatibility-matrix.md')
const compatibilityIds = [...matrixText.matchAll(/^\| (COMP-\d{3}) \|/gm)].map((match) => match[1])
const compatibilitySet = new Set(compatibilityIds)
if (compatibilityIds.length !== compatibilitySet.size) errors.push('duplicate COMP id in compatibility matrix')
for (let value = 1; value <= 36; value += 1) {
  const id = `COMP-${String(value).padStart(3, '0')}`
  if (!compatibilitySet.has(id)) errors.push(`missing compatibility item ${id}`)
}
const taskCompatibilityRefs = expandReferences(taskDocs, new Set(['COMP']))
for (const id of compatibilitySet) {
  if (!taskCompatibilityRefs.has(id)) errors.push(`compatibility item ${id} is not referenced by a task`)
}

const requiredPlanningContracts = new Map([
  ['AGENTS.md', ['M0-T01 自举例外', '`pnpm install`', '`pnpm build`', 'TC-M0-001', 'M0-T02', '占位 `check`']],
  ['docs/09-test-strategy.md', ['M0-T01 自举例外', '`pnpm install`', '`pnpm build`', 'TC-M0-001', 'M0-T02', '固定成功脚本']],
  ['tasks/M0-foundation.md', ['`package.json#packageManager`', '`pnpm@11.12.0`', 'M0-T01 自举例外', 'TC-M0-001']],
  ['docs/08-development-plan.md', ['pnpm 11.12.0', '`corepack install --global pnpm@11.12.0`']],
  ['docs/11-codex-cli-runbook.md', ['corepack install --global pnpm@11.12.0', 'M0-T01 使用', '占位脚本']],
  ['docs/04-technology-stack.md', ['| 依赖 | 用途 | 许可证 | 原生二进制 | 安装脚本 | 替代方案 | 包体影响 |']],
  ['docs/02-compatibility-matrix.md', ['EXP-005,007,009', 'IMP-001..030']],
  ['docs/03-architecture.md', ['Pandoc 导入是独立的只读源转换', '不创建部分会话']],
  ['docs/05-data-safety-and-security.md', ['Pandoc 导入只读源文件', 'staging']],
  ['docs/15-public-contracts.md', ['interface ImportAdapter', 'interface ImportedDocument', 'stagingId', 'file.new/open/openFolder/import']],
  ['docs/17-settings-and-storage-schema.md', ['interface RecoveryMetaV2', 'importStagingId', 'M6-T08']],
  ['docs/18-error-catalog.md', ['IMPORT_UNSUPPORTED_FORMAT', 'IMPORT_OUTPUT_INVALID', 'IMPORT_FAILED']],
  ['docs/19-user-journeys.md', ['## J-013 Pandoc 导入', '源文件哈希始终不变']],
  ['docs/21-command-menu-inventory.md', ['`file.import`', 'Pandoc 缺失']],
  ['docs/test-cases/M6-export.md', ['TC-M6-010', 'PANDOCIMPORT-M6', 'MAN-M6-002']]
])
for (const [file, snippets] of requiredPlanningContracts) {
  for (const snippet of snippets) {
    if (!read(file).includes(snippet)) errors.push(`${file} is missing required planning contract: ${snippet}`)
  }
}

const bootstrapSection = taskSections.get('M0-T01') ?? ''
for (const snippet of ['pnpm install', '开发窗口启动', 'pnpm build', 'pnpm-lock.yaml', 'TC-M0-001']) {
  if (!bootstrapSection.includes(snippet)) errors.push(`M0-T01 bootstrap contract is missing: ${snippet}`)
}
if (/\bpnpm\s+check\b/.test(bootstrapSection)) {
  errors.push('M0-T01 bootstrap exception must not require pnpm check before M0-T02 creates it')
}
if (!taskSections.get('M0-T02')?.includes('反向自动化')) {
  errors.push('M0-T02 must explicitly automate the M0-T01 bootstrap regression')
}

const pandocImportRequirementRefs = expandReferences(taskSections.get('M6-T08') ?? '', requirementPrefixes)
if (!pandocImportRequirementRefs.has('EXP-009')) {
  errors.push('M6-T08 must own EXP-009')
}
if ((taskToAutomatedCases.get('M6-T08') ?? []).join(',') !== 'TC-M6-010') {
  errors.push(`M6-T08 must own exactly TC-M6-010, found ${(taskToAutomatedCases.get('M6-T08') ?? []).join(', ')}`)
}
if (!(taskToManualCases.get('M6-T09') ?? []).includes('MAN-M6-002')) {
  errors.push('M6-T09 must own MAN-M6-002')
}
if (byId.get('M6-T09')?.manual_gate !== true) {
  errors.push('M6-T09 must remain a manual gate for Pandoc import/export verification')
}
const expectedPandocDependencies = new Map([
  ['M6-T08', ['M6-T06']],
  ['M6-T09', ['M6-T05', 'M6-T07', 'M6-T08']],
  ['M7-T01', ['M6-T09']]
])
for (const [taskId, expectedDependencies] of expectedPandocDependencies) {
  const actualDependencies = byId.get(taskId)?.depends_on ?? []
  if ([...actualDependencies].sort().join(',') !== [...expectedDependencies].sort().join(',')) {
    errors.push(`${taskId} has invalid Pandoc dependency chain: ${actualDependencies.join(', ')}`)
  }
}

const markdownFiles = requiredFiles.filter((file) => file.endsWith('.md'))
for (const file of markdownFiles) {
  const content = read(file)
  for (const match of content.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const target = match[1].split('#')[0]
    if (!target || /^[a-z]+:/i.test(target)) continue
    const resolved = path.resolve(root, path.dirname(file), decodeURIComponent(target))
    if (!fs.existsSync(resolved)) errors.push(`broken local link in ${file}: ${match[1]}`)
  }
}

const inProgress = tasks.filter((task) => task.status === 'in_progress')
if (inProgress.length > 1) errors.push(`more than one in_progress task: ${inProgress.map((task) => task.id).join(', ')}`)
if (inProgress.length === 0 && state.current_task !== null) {
  errors.push(`current_task must be null when no task is in_progress: ${state.current_task}`)
}
if (inProgress.length === 1 && state.current_task !== inProgress[0].id) {
  errors.push(`current_task ${state.current_task} does not match in_progress task ${inProgress[0].id}`)
}

for (const task of tasks) {
  const dependenciesPassed = (task.depends_on ?? []).every((id) => byId.get(id)?.status === 'passed')
  if (['ready', 'in_progress', 'awaiting_manual', 'passed', 'failed'].includes(task.status) && !dependenciesPassed) {
    errors.push(`${task.id} is ${task.status} while one or more dependencies are not passed`)
  }
  if (task.status === 'blocked' && dependenciesPassed) {
    errors.push(`${task.id} is blocked even though all dependencies are passed`)
  }
  if (task.status === 'awaiting_manual' && !task.manual_gate) {
    errors.push(`${task.id} is awaiting_manual but manual_gate is false`)
  }
  if (task.status === 'passed' && task.manual_gate) {
    const hasManualEvidence = (task.evidence ?? []).some((item) => item.kind === 'manual')
    if (!hasManualEvidence) errors.push(`${task.id} passed without required manual evidence`)
  }
  if (task.status === 'passed') {
    const hasAutomatedEvidence = (task.evidence ?? []).some((item) =>
      ['command', 'test', 'report'].includes(item.kind)
    )
    if (!hasAutomatedEvidence) errors.push(`${task.id} passed without automated command/test/report evidence`)
  }
}

const docsIndex = read('docs/README.md')
for (const file of requiredFiles.filter((file) => /^docs\/\d{2}-.*\.md$/.test(file))) {
  const name = path.basename(file)
  if (!docsIndex.includes(`](${name})`)) errors.push(`docs/README.md does not link ${name}`)
}

for (const file of markdownFiles) {
  const fenceCount = read(file).split(/\r?\n/).filter((line) => /^```/.test(line)).length
  if (fenceCount % 2 !== 0) errors.push(`unbalanced fenced code block in ${file}`)
}

const agentsBytes = Buffer.byteLength(read('AGENTS.md'), 'utf8')
if (agentsBytes > 32768) errors.push(`AGENTS.md exceeds Codex default 32 KiB instruction limit: ${agentsBytes}`)

if (errors.length > 0) reportErrorsAndExit()

console.log(`Planning documentation verified: ${requiredFiles.length} required files, ${tasks.length} tasks, ${automatedCases.size} automated test cases, ${manualCases.size} manual cases, ${definedRequirements.size} requirements, ${compatibilitySet.size} compatibility items.`)
