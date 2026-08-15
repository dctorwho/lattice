const ALLOWED_STATUSES = ['blocked', 'ready', 'in_progress', 'awaiting_manual', 'passed', 'failed']

const ITERATION_FOLDERS = [
  'M0-foundation',
  'M1-document-core',
  'M2-hybrid-editor',
  'M3-workspace-shell',
  'M4-advanced-markdown',
  'M5-media-theme',
  'M6-export',
  'M7-parity-hardening',
  'M8-windows-release'
]

const TOP_LEVEL_KEYS = new Set([
  'schema_version',
  'product_baseline',
  'current_iteration',
  'allowed_statuses',
  'iterations'
])
const ITERATION_KEYS = new Set([
  'id',
  'status',
  'depends_on',
  'manual_gate',
  'entry',
  'exit',
  'evidence'
])
const ENTRY_KEYS = new Set(['requirements', 'detailed_design', 'test_cases'])
const EXIT_KEYS = new Set(['test_report', 'iteration_report'])
const EVIDENCE_KEYS = new Set(['kind', 'summary', 'path', 'recorded_at'])
const EVIDENCE_KINDS = new Set(['command', 'test', 'report', 'manual'])
const ACTIVE_STATUSES = new Set(['in_progress', 'awaiting_manual'])
const MANDATORY_MANUAL_GATES = new Set(['M0', 'M1', 'M2', 'M5', 'M6', 'M8'])
const TOP_LEVEL_SCHEMA_KEYS = new Set([
  '$schema',
  '$id',
  'title',
  'type',
  'additionalProperties',
  'required',
  'properties',
  '$defs'
])
const CLOSED_OBJECT_SCHEMA_KEYS = new Set([
  'type',
  'additionalProperties',
  'required',
  'properties'
])
const CONST_SCHEMA_KEYS = new Set(['const'])
const STRING_PATTERN_SCHEMA_KEYS = new Set(['type', 'pattern'])
const STRING_MIN_PATTERN_SCHEMA_KEYS = new Set(['type', 'minLength', 'pattern'])
const ARRAY_BOUNDED_REF_SCHEMA_KEYS = new Set(['type', 'minItems', 'maxItems', 'items'])
const ROLE_PATH_SCHEMA_KEYS = new Set(['allOf'])
const PATTERN_SCHEMA_KEYS = new Set(['pattern'])
const ENUM_SCHEMA_KEYS = new Set(['enum'])
const REFERENCE_SCHEMA_KEYS = new Set(['$ref'])
const DATE_TIME_SCHEMA_KEYS = new Set(['type', 'format'])
const DEPENDENCY_SCHEMA_KEYS = new Set(['type', 'maxItems', 'uniqueItems', 'items'])
const BOOLEAN_SCHEMA_KEYS = new Set(['type'])
const ARRAY_REF_SCHEMA_KEYS = new Set(['type', 'items'])

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const addUnknownPropertyErrors = (value, allowedKeys, location, errors) => {
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) errors.push(`${location} has unsupported property: ${key}`)
  }
}

const requireKeys = (value, requiredKeys, location, errors) => {
  for (const key of requiredKeys) {
    if (!(key in value)) errors.push(`${location} is missing required property: ${key}`)
  }
}

const arraysEqual = (left, right) =>
  Array.isArray(left) &&
  left.length === right.length &&
  left.every((value, index) => value === right[index])

const hasExactMembers = (value, expected) =>
  Array.isArray(value) &&
  value.length === expected.size &&
  new Set(value).size === value.length &&
  value.every((item) => typeof item === 'string' && expected.has(item))

const hasExactObjectKeys = (value, expected) =>
  isPlainObject(value) &&
  Object.keys(value).length === expected.size &&
  Object.keys(value).every((key) => expected.has(key))

const isRepositoryRelativePath = (value) => {
  if (typeof value !== 'string' || value.length === 0) return false
  if (value.includes('\\') || value.includes('//') || value.includes(':')) return false
  if (value.startsWith('/') || /^[A-Za-z]:/.test(value) || /^[a-z][a-z0-9+.-]*:/i.test(value)) {
    return false
  }

  const segments = value.split('/')
  return segments.every((segment) => segment !== '' && segment !== '.' && segment !== '..')
}

const validatePlanningPath = (value, iterationId, folder, role, filename, errors) => {
  const location = `${iterationId} ${role}`
  if (!isRepositoryRelativePath(value)) {
    errors.push(`${location} must be a repository-relative forward-slash path`)
  }

  if (typeof value !== 'string') {
    errors.push(`${location} must use ${filename}`)
    return
  }

  const segments = value.split('/')
  const actualDirectory = segments.slice(0, -1).join('/')
  const expectedDirectory = `iterations/${folder}`
  if (actualDirectory !== expectedDirectory) {
    errors.push(`${location} must stay in its owning iteration directory ${expectedDirectory}`)
  }
  if (segments.at(-1) !== filename) errors.push(`${location} must use ${filename}`)
}

const isRfc3339DateTime = (value) => {
  if (typeof value !== 'string') return false
  const match =
    /^(\d{4})-(\d{2})-(\d{2})[Tt](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?([Zz]|[+-](\d{2}):(\d{2}))$/.exec(
      value
    )
  if (match === null) return false

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const hour = Number(match[4])
  const minute = Number(match[5])
  const second = Number(match[6])
  const zone = match[7]
  const offsetHour = Number(match[8] ?? 0)
  const offsetMinute = Number(match[9] ?? 0)
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

  if (year < 1 || month < 1 || month > 12) return false
  if (day < 1 || day > daysInMonth[month - 1]) return false
  if (hour > 23 || minute > 59 || second > 60) return false
  if (zone.toUpperCase() !== 'Z' && (offsetHour > 23 || offsetMinute > 59)) return false
  if (second === 60) {
    const offsetDirection = zone.startsWith('-') ? -1 : 1
    const offset =
      zone.toUpperCase() === 'Z' ? 0 : offsetDirection * (offsetHour * 60 + offsetMinute)
    const instantBeforeLeapSecond = new Date(0)
    instantBeforeLeapSecond.setUTCFullYear(year, month - 1, day)
    instantBeforeLeapSecond.setUTCHours(hour, minute - offset, 59, 0)
    const isLeapSecondBoundary =
      instantBeforeLeapSecond.getUTCHours() === 23 &&
      instantBeforeLeapSecond.getUTCMinutes() === 59 &&
      ((instantBeforeLeapSecond.getUTCMonth() === 5 &&
        instantBeforeLeapSecond.getUTCDate() === 30) ||
        (instantBeforeLeapSecond.getUTCMonth() === 11 &&
          instantBeforeLeapSecond.getUTCDate() === 31))
    if (!isLeapSecondBoundary) return false
  }
  return true
}

const schemaContractError = (errors, location) => {
  errors.push(`iteration state schema ${location} contract mismatch`)
}

const validateClosedObjectSchema = (
  definition,
  location,
  requiredKeys,
  propertyKeys,
  errors,
  schemaKeys = CLOSED_OBJECT_SCHEMA_KEYS
) => {
  if (
    !isPlainObject(definition) ||
    !hasExactObjectKeys(definition, schemaKeys) ||
    definition.type !== 'object' ||
    definition.additionalProperties !== false ||
    !hasExactMembers(definition.required, requiredKeys) ||
    !hasExactObjectKeys(definition.properties, propertyKeys)
  ) {
    schemaContractError(errors, location)
    return null
  }
  return definition.properties
}

const isExactReferenceSchema = (value, reference) =>
  hasExactObjectKeys(value, REFERENCE_SCHEMA_KEYS) && value.$ref === reference

const validateRolePathSchema = (value, pattern, location, errors) => {
  if (
    !hasExactObjectKeys(value, ROLE_PATH_SCHEMA_KEYS) ||
    !Array.isArray(value.allOf) ||
    value.allOf.length !== 2
  ) {
    schemaContractError(errors, location)
    return
  }
  const hasPathReference = value.allOf.some((part) =>
    isExactReferenceSchema(part, '#/$defs/repositoryPath')
  )
  const hasRolePattern = value.allOf.some(
    (part) => hasExactObjectKeys(part, PATTERN_SCHEMA_KEYS) && part.pattern === pattern
  )
  if (!hasPathReference || !hasRolePattern) schemaContractError(errors, location)
}

const validateSchemaContract = (schema, errors) => {
  if (!isPlainObject(schema)) {
    errors.push('iteration state schema must be an object')
    return
  }

  const properties = validateClosedObjectSchema(
    schema,
    'top-level',
    TOP_LEVEL_KEYS,
    TOP_LEVEL_KEYS,
    errors,
    TOP_LEVEL_SCHEMA_KEYS
  )
  if (properties === null) return
  if (
    schema.$schema !== 'https://json-schema.org/draft/2020-12/schema' ||
    schema.$id !== 'https://lattice.local/schemas/iteration-state-v2.json' ||
    schema.title !== 'Lattice iteration state'
  ) {
    schemaContractError(errors, 'top-level metadata')
  }

  const versionSchema = isPlainObject(properties.schema_version) ? properties.schema_version : null
  if (
    versionSchema === null ||
    !hasExactObjectKeys(versionSchema, CONST_SCHEMA_KEYS) ||
    versionSchema.const !== 2
  ) {
    errors.push('iteration state schema must require schema_version 2')
  }

  const baselineSchema = isPlainObject(properties.product_baseline)
    ? properties.product_baseline
    : null
  if (
    baselineSchema === null ||
    !hasExactObjectKeys(baselineSchema, STRING_MIN_PATTERN_SCHEMA_KEYS) ||
    baselineSchema.type !== 'string' ||
    baselineSchema.minLength !== 1 ||
    baselineSchema.pattern !== '\\S'
  ) {
    schemaContractError(errors, 'product_baseline')
  }

  const currentSchema = isPlainObject(properties.current_iteration)
    ? properties.current_iteration
    : null
  if (
    currentSchema === null ||
    !hasExactObjectKeys(currentSchema, STRING_PATTERN_SCHEMA_KEYS) ||
    currentSchema.type !== 'string' ||
    currentSchema.pattern !== '^M[0-8]$'
  ) {
    schemaContractError(errors, 'current_iteration')
  }

  const statusesSchema = isPlainObject(properties.allowed_statuses)
    ? properties.allowed_statuses
    : null
  if (
    statusesSchema === null ||
    !hasExactObjectKeys(statusesSchema, CONST_SCHEMA_KEYS) ||
    !arraysEqual(statusesSchema.const, ALLOWED_STATUSES)
  ) {
    errors.push('iteration state schema must require the six fixed statuses')
  }

  const iterationsSchema = isPlainObject(properties.iterations) ? properties.iterations : null
  if (
    iterationsSchema === null ||
    !hasExactObjectKeys(iterationsSchema, ARRAY_BOUNDED_REF_SCHEMA_KEYS) ||
    iterationsSchema.type !== 'array' ||
    iterationsSchema.minItems !== 9 ||
    iterationsSchema.maxItems !== 9 ||
    !isExactReferenceSchema(iterationsSchema.items, '#/$defs/iteration')
  ) {
    schemaContractError(errors, 'iterations')
  }

  const definitionKeys = new Set(['repositoryPath', 'entry', 'exit', 'evidence', 'iteration'])
  if (!hasExactObjectKeys(schema.$defs, definitionKeys)) {
    schemaContractError(errors, '$defs')
    return
  }
  const definitions = schema.$defs

  const repositoryPath = isPlainObject(definitions.repositoryPath)
    ? definitions.repositoryPath
    : null
  if (
    repositoryPath === null ||
    !hasExactObjectKeys(repositoryPath, STRING_MIN_PATTERN_SCHEMA_KEYS) ||
    repositoryPath.type !== 'string' ||
    repositoryPath.minLength !== 1 ||
    repositoryPath.pattern !== '^(?![A-Za-z]:)(?!/)(?!.*(?:^|/)\\.\\.?/)(?!.*\\\\)(?!.*//)[^:]+$'
  ) {
    schemaContractError(errors, 'repositoryPath')
  }

  const entryProperties = validateClosedObjectSchema(
    definitions.entry,
    'entry',
    ENTRY_KEYS,
    ENTRY_KEYS,
    errors
  )
  if (entryProperties !== null) {
    validateRolePathSchema(
      entryProperties.requirements,
      '^iterations/M[0-8]-[a-z0-9-]+/01-requirements\\.md$',
      'entry.requirements',
      errors
    )
    validateRolePathSchema(
      entryProperties.detailed_design,
      '^iterations/M[0-8]-[a-z0-9-]+/02-detailed-design\\.md$',
      'entry.detailed_design',
      errors
    )
    validateRolePathSchema(
      entryProperties.test_cases,
      '^iterations/M[0-8]-[a-z0-9-]+/03-test-cases\\.md$',
      'entry.test_cases',
      errors
    )
  }

  const exitProperties = validateClosedObjectSchema(
    definitions.exit,
    'exit',
    EXIT_KEYS,
    EXIT_KEYS,
    errors
  )
  if (exitProperties !== null) {
    validateRolePathSchema(
      exitProperties.test_report,
      '^iterations/M[0-8]-[a-z0-9-]+/04-test-report\\.md$',
      'exit.test_report',
      errors
    )
    validateRolePathSchema(
      exitProperties.iteration_report,
      '^iterations/M[0-8]-[a-z0-9-]+/05-exit-report\\.md$',
      'exit.iteration_report',
      errors
    )
  }

  const evidenceProperties = validateClosedObjectSchema(
    definitions.evidence,
    'evidence.additionalProperties',
    new Set(['kind', 'summary', 'recorded_at']),
    EVIDENCE_KEYS,
    errors
  )
  if (evidenceProperties !== null) {
    if (
      !isPlainObject(evidenceProperties.kind) ||
      !hasExactObjectKeys(evidenceProperties.kind, ENUM_SCHEMA_KEYS) ||
      !arraysEqual(evidenceProperties.kind.enum, [...EVIDENCE_KINDS])
    ) {
      schemaContractError(errors, 'evidence.kind')
    }
    if (
      !isPlainObject(evidenceProperties.summary) ||
      !hasExactObjectKeys(evidenceProperties.summary, STRING_MIN_PATTERN_SCHEMA_KEYS) ||
      evidenceProperties.summary.type !== 'string' ||
      evidenceProperties.summary.minLength !== 1 ||
      evidenceProperties.summary.pattern !== '\\S'
    ) {
      schemaContractError(errors, 'evidence.summary')
    }
    if (!isExactReferenceSchema(evidenceProperties.path, '#/$defs/repositoryPath')) {
      schemaContractError(errors, 'evidence.path')
    }
    if (
      !isPlainObject(evidenceProperties.recorded_at) ||
      !hasExactObjectKeys(evidenceProperties.recorded_at, DATE_TIME_SCHEMA_KEYS) ||
      evidenceProperties.recorded_at.type !== 'string' ||
      evidenceProperties.recorded_at.format !== 'date-time'
    ) {
      schemaContractError(errors, 'evidence.recorded_at')
    }
  }

  const iterationProperties = validateClosedObjectSchema(
    definitions.iteration,
    'iteration',
    ITERATION_KEYS,
    ITERATION_KEYS,
    errors
  )
  if (iterationProperties === null) return
  if (
    !isPlainObject(iterationProperties.id) ||
    !hasExactObjectKeys(iterationProperties.id, STRING_PATTERN_SCHEMA_KEYS) ||
    iterationProperties.id.type !== 'string' ||
    iterationProperties.id.pattern !== '^M[0-8]$'
  ) {
    schemaContractError(errors, 'iteration.id')
  }
  if (
    !isPlainObject(iterationProperties.status) ||
    !hasExactObjectKeys(iterationProperties.status, ENUM_SCHEMA_KEYS) ||
    !arraysEqual(iterationProperties.status.enum, ALLOWED_STATUSES)
  ) {
    schemaContractError(errors, 'iteration.status')
  }
  const dependencies = isPlainObject(iterationProperties.depends_on)
    ? iterationProperties.depends_on
    : null
  if (
    dependencies === null ||
    !hasExactObjectKeys(dependencies, DEPENDENCY_SCHEMA_KEYS) ||
    dependencies.type !== 'array' ||
    dependencies.maxItems !== 1 ||
    dependencies.uniqueItems !== true ||
    !isPlainObject(dependencies.items) ||
    !hasExactObjectKeys(dependencies.items, STRING_PATTERN_SCHEMA_KEYS) ||
    dependencies.items.type !== 'string' ||
    dependencies.items.pattern !== '^M[0-8]$'
  ) {
    schemaContractError(errors, 'iteration.depends_on')
  }
  if (
    !isPlainObject(iterationProperties.manual_gate) ||
    !hasExactObjectKeys(iterationProperties.manual_gate, BOOLEAN_SCHEMA_KEYS) ||
    iterationProperties.manual_gate.type !== 'boolean'
  ) {
    schemaContractError(errors, 'iteration.manual_gate')
  }
  if (!isExactReferenceSchema(iterationProperties.entry, '#/$defs/entry')) {
    schemaContractError(errors, 'iteration.entry')
  }
  if (!isExactReferenceSchema(iterationProperties.exit, '#/$defs/exit')) {
    schemaContractError(errors, 'iteration.exit')
  }
  if (
    !isPlainObject(iterationProperties.evidence) ||
    !hasExactObjectKeys(iterationProperties.evidence, ARRAY_REF_SCHEMA_KEYS) ||
    iterationProperties.evidence.type !== 'array' ||
    !isExactReferenceSchema(iterationProperties.evidence.items, '#/$defs/evidence')
  ) {
    schemaContractError(errors, 'iteration.evidence')
  }
}

const validateEntry = (entry, iterationId, folder, errors) => {
  if (!isPlainObject(entry)) {
    errors.push(`${iterationId} entry must be an object`)
    return
  }
  addUnknownPropertyErrors(entry, ENTRY_KEYS, `${iterationId} entry`, errors)
  requireKeys(entry, ENTRY_KEYS, `${iterationId} entry`, errors)
  validatePlanningPath(
    entry.requirements,
    iterationId,
    folder,
    'entry.requirements',
    '01-requirements.md',
    errors
  )
  validatePlanningPath(
    entry.detailed_design,
    iterationId,
    folder,
    'entry.detailed_design',
    '02-detailed-design.md',
    errors
  )
  validatePlanningPath(
    entry.test_cases,
    iterationId,
    folder,
    'entry.test_cases',
    '03-test-cases.md',
    errors
  )
}

const validateExit = (exit, iterationId, folder, errors) => {
  if (!isPlainObject(exit)) {
    errors.push(`${iterationId} exit must be an object`)
    return
  }
  addUnknownPropertyErrors(exit, EXIT_KEYS, `${iterationId} exit`, errors)
  requireKeys(exit, EXIT_KEYS, `${iterationId} exit`, errors)
  validatePlanningPath(
    exit.test_report,
    iterationId,
    folder,
    'exit.test_report',
    '04-test-report.md',
    errors
  )
  validatePlanningPath(
    exit.iteration_report,
    iterationId,
    folder,
    'exit.iteration_report',
    '05-exit-report.md',
    errors
  )
}

const validateEvidence = (evidence, iterationId, errors) => {
  if (!Array.isArray(evidence)) {
    errors.push(`${iterationId} evidence must be an array`)
    return
  }

  for (const [index, record] of evidence.entries()) {
    const location = `${iterationId} evidence[${index}]`
    if (!isPlainObject(record)) {
      errors.push(`${location} must be an object`)
      continue
    }
    addUnknownPropertyErrors(record, EVIDENCE_KEYS, location, errors)
    requireKeys(record, new Set(['kind', 'summary', 'recorded_at']), location, errors)
    if (!EVIDENCE_KINDS.has(record.kind)) errors.push(`${location} has invalid kind`)
    if (typeof record.summary !== 'string' || record.summary.trim().length === 0) {
      errors.push(`${location} summary must be a non-empty string`)
    }
    if (record.path !== undefined && !isRepositoryRelativePath(record.path)) {
      errors.push(`${location} path must be repository-relative`)
    }
    if (!isRfc3339DateTime(record.recorded_at)) {
      errors.push(`${location} recorded_at must be an RFC 3339 date-time`)
    }
  }
}

const findDependencyCycles = (iterationsById, errors) => {
  const visiting = new Set()
  const visited = new Set()
  const reported = new Set()

  const visit = (id, trail) => {
    if (visiting.has(id)) {
      const cycleStart = trail.indexOf(id)
      const cycle = [...trail.slice(cycleStart), id]
      const signature = [...new Set(cycle)].sort().join(',')
      if (!reported.has(signature)) {
        errors.push(`dependency cycle: ${cycle.join(' -> ')}`)
        reported.add(signature)
      }
      return
    }
    if (visited.has(id)) return

    visiting.add(id)
    const iteration = iterationsById.get(id)
    if (iteration !== undefined && Array.isArray(iteration.depends_on)) {
      for (const dependency of iteration.depends_on) {
        if (iterationsById.has(dependency)) visit(dependency, [...trail, id])
      }
    }
    visiting.delete(id)
    visited.add(id)
  }

  for (const id of iterationsById.keys()) visit(id, [])
}

export function validateIterationState(state, schema) {
  const errors = []
  validateSchemaContract(schema, errors)

  if (!isPlainObject(state)) {
    errors.push('iterations/state.json must be an object')
    return errors
  }

  addUnknownPropertyErrors(state, TOP_LEVEL_KEYS, 'iterations/state.json', errors)
  requireKeys(state, TOP_LEVEL_KEYS, 'iterations/state.json', errors)

  if (state.schema_version !== 2) errors.push('iterations/state.json schema_version must be 2')
  if (typeof state.product_baseline !== 'string' || state.product_baseline.trim().length === 0) {
    errors.push('iterations/state.json product_baseline must be a non-empty string')
  }
  if (typeof state.current_iteration !== 'string' || !/^M[0-8]$/.test(state.current_iteration)) {
    errors.push(`iterations/state.json has invalid current_iteration: ${state.current_iteration}`)
  }
  if (!arraysEqual(state.allowed_statuses, ALLOWED_STATUSES)) {
    errors.push('iterations/state.json allowed_statuses must equal the six fixed statuses')
  }
  if (!Array.isArray(state.iterations)) {
    errors.push('iterations/state.json iterations must be an array')
    return errors
  }
  if (state.iterations.length !== 9) {
    errors.push(
      `iteration id set must contain exactly M0 through M8; found ${state.iterations.length}`
    )
  }

  const iterationsById = new Map()
  for (const [index, iteration] of state.iterations.entries()) {
    const expectedId = `M${index}`
    if (!isPlainObject(iteration)) {
      errors.push(`iteration id at index ${index} must identify an object`)
      continue
    }

    addUnknownPropertyErrors(iteration, ITERATION_KEYS, `${iteration.id ?? expectedId}`, errors)
    requireKeys(iteration, ITERATION_KEYS, `${iteration.id ?? expectedId}`, errors)

    if (typeof iteration.id !== 'string' || !/^M[0-8]$/.test(iteration.id)) {
      errors.push(`invalid iteration id at index ${index}: ${iteration.id}`)
    } else if (iterationsById.has(iteration.id)) {
      errors.push(`duplicate iteration id: ${iteration.id}`)
    } else {
      iterationsById.set(iteration.id, iteration)
    }
    if (iteration.id !== expectedId) {
      errors.push(`iteration id at index ${index} must be ${expectedId}, found ${iteration.id}`)
    }

    if (!ALLOWED_STATUSES.includes(iteration.status)) {
      errors.push(`${iteration.id ?? expectedId} has invalid status: ${iteration.status}`)
    }
    if (!Array.isArray(iteration.depends_on)) {
      errors.push(`${iteration.id ?? expectedId} depends_on must be an array`)
    } else if (new Set(iteration.depends_on).size !== iteration.depends_on.length) {
      errors.push(`${iteration.id ?? expectedId} has duplicate dependencies`)
    }
    if (typeof iteration.manual_gate !== 'boolean') {
      errors.push(`${iteration.id ?? expectedId} manual_gate must be boolean`)
    }
    if (MANDATORY_MANUAL_GATES.has(expectedId) && iteration.manual_gate !== true) {
      errors.push(`${expectedId} manual_gate is mandatory`)
    }

    const folder = ITERATION_FOLDERS[index]
    if (folder !== undefined) {
      validateEntry(iteration.entry, expectedId, folder, errors)
      validateExit(iteration.exit, expectedId, folder, errors)
    }
    validateEvidence(iteration.evidence, iteration.id ?? expectedId, errors)
  }

  for (const [index, iteration] of state.iterations.entries()) {
    if (!isPlainObject(iteration) || !Array.isArray(iteration.depends_on)) continue
    const id = typeof iteration.id === 'string' ? iteration.id : `iterations[${index}]`
    for (const dependency of iteration.depends_on) {
      if (dependency === id) errors.push(`${id} depends on itself`)
      if (typeof dependency !== 'string' || !iterationsById.has(dependency)) {
        errors.push(`${id} depends on unknown iteration ${dependency}`)
      }
    }

    const expectedDependencies = index === 0 ? [] : [`M${index - 1}`]
    if (!arraysEqual(iteration.depends_on, expectedDependencies)) {
      errors.push(
        `${id} must use the linear dependency [${expectedDependencies.join(', ')}], found [${iteration.depends_on.join(', ')}]`
      )
    }
  }

  findDependencyCycles(iterationsById, errors)

  const active = state.iterations.filter(
    (iteration) => isPlainObject(iteration) && ACTIVE_STATUSES.has(iteration.status)
  )
  if (active.length > 1) errors.push('iterations/state.json allows at most one active iteration')

  const frontierIndex = state.iterations.findIndex(
    (iteration) => !isPlainObject(iteration) || iteration.status !== 'passed'
  )
  const expectedFrontier = frontierIndex === -1 ? 'M8' : `M${frontierIndex}`
  if (
    typeof state.current_iteration === 'string' &&
    /^M[0-8]$/.test(state.current_iteration) &&
    state.current_iteration !== expectedFrontier
  ) {
    errors.push(
      `current_iteration must identify ${expectedFrontier} frontier, found ${state.current_iteration}`
    )
  }

  for (const iteration of state.iterations) {
    if (!isPlainObject(iteration) || typeof iteration.id !== 'string') continue
    const dependencies = Array.isArray(iteration.depends_on) ? iteration.depends_on : []
    const dependenciesPassed =
      dependencies.length === 0 ||
      dependencies.every((dependency) => iterationsById.get(dependency)?.status === 'passed')
    if (iteration.status === 'blocked' && dependenciesPassed) {
      errors.push(`${iteration.id} is blocked despite passed dependencies`)
    }
    if (iteration.status !== 'blocked' && dependencies.length > 0 && !dependenciesPassed) {
      errors.push(`${iteration.id} status ${iteration.status} requires all dependencies to pass`)
    }
    if (iteration.status === 'awaiting_manual' && iteration.manual_gate !== true) {
      errors.push(`${iteration.id} cannot await a manual gate when manual_gate is false`)
    }
    if (
      iteration.status === 'failed' &&
      (!Array.isArray(iteration.evidence) || iteration.evidence.length === 0)
    ) {
      errors.push(`${iteration.id} failed status requires failure evidence`)
    }
    if (
      iteration.status === 'passed' &&
      (iteration.manual_gate === true || MANDATORY_MANUAL_GATES.has(iteration.id)) &&
      (!Array.isArray(iteration.evidence) ||
        !iteration.evidence.some((record) => isPlainObject(record) && record.kind === 'manual'))
    ) {
      errors.push(`${iteration.id} passed manual gate requires manual evidence`)
    }
  }

  return errors
}

export function collectReferenceIds(text, allowedPrefixes) {
  const found = new Set()
  const referencePattern =
    /\b([A-Z][A-Z0-9]*)-(\d{3})(?:\.\.(?:([A-Z][A-Z0-9]*)-)?(\d{3}))?\b(?!\.\.)/g

  for (const match of text.matchAll(referencePattern)) {
    const prefix = match[1]
    if (!allowedPrefixes.has(prefix)) continue

    const start = Number(match[2])
    const end = match[4] === undefined ? start : Number(match[4])
    const endPrefix = match[3] ?? prefix
    if (endPrefix !== prefix || end < start) continue

    for (let value = start; value <= end; value += 1) {
      found.add(`${prefix}-${String(value).padStart(3, '0')}`)
    }
  }

  return found
}

const parseMarkdownTableCells = (line) => {
  const trimmed = line.trim()
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return null
  return trimmed
    .slice(1, -1)
    .split('|')
    .map((cell) => cell.trim())
}

const normalizeHeaderCell = (value) =>
  value
    .toLocaleLowerCase('en-US')
    .replace(/[`*_]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '')

const HEADER_ROLES = new Map([
  ['id', 'id'],
  ['用例id', 'id'],
  ['caseid', 'id'],
  ['testcaseid', 'id'],
  ['覆盖能力', 'capability'],
  ['capability', 'capability'],
  ['coverage', 'capability'],
  ['capabilitycoverage', 'capability'],
  ['层级', 'level'],
  ['级别', 'level'],
  ['层级级别', 'level'],
  ['level', 'level'],
  ['layerpriority', 'level'],
  ['levelpriority', 'level'],
  ['数据环境', 'data'],
  ['数据夹具', 'data'],
  ['dataenvironment', 'data'],
  ['datafixture', 'data'],
  ['fixture', 'data'],
  ['fixtures', 'data'],
  ['环境', 'environment'],
  ['environment', 'environment'],
  ['步骤', 'steps'],
  ['step', 'steps'],
  ['steps', 'steps'],
  ['预期', 'expected'],
  ['预期结果', 'expected'],
  ['通过条件', 'expected'],
  ['expected', 'expected'],
  ['expectedresult', 'expected'],
  ['passcriteria', 'expected'],
  ['自动化', 'automation'],
  ['自动化目标', 'automation'],
  ['automation', 'automation'],
  ['automationtarget', 'automation'],
  ['证据', 'evidence'],
  ['evidence', 'evidence'],
  ['任务', 'task'],
  ['所属任务', 'task'],
  ['任务归属', 'task'],
  ['任务所有者', 'task'],
  ['task', 'task'],
  ['taskowner', 'task'],
  ['ownertask', 'task']
])

const AUTOMATED_HEADER_ROLES = [
  'id',
  'capability',
  'level',
  'data',
  'steps',
  'expected',
  'automation'
]
const MANUAL_HEADER_ROLES = ['id', 'capability', 'environment', 'steps', 'expected', 'evidence']

const isMarkdownTableSeparator = (cells) =>
  cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell))

const isTestCaseCandidate = (cells) => /^(?:TC|MAN)-/i.test(cells[0] ?? '')

const validateTestCaseId = (candidate, iterationId, seen, errors) => {
  const idMatch = /^(TC|MAN)-(M\d+)-(\d{3})$/.exec(candidate)
  if (idMatch === null) {
    errors.push(`malformed test case id: ${candidate}`)
    return null
  }

  const [, kind, owner] = idMatch
  if (owner !== iterationId) {
    errors.push(`${candidate} belongs to ${owner}, not ${iterationId}`)
    return null
  }
  if (seen.has(candidate)) {
    errors.push(`duplicate test case id: ${candidate}`)
    return null
  }
  return kind
}

export function parseIterationTestCases(text, iterationId) {
  const automated = []
  const manual = []
  const errors = []
  const seen = new Set()
  const lines = text.split(/\r?\n/)
  const consumedCandidates = new Set()

  if (!/^M[0-8]$/.test(iterationId)) {
    errors.push(`invalid owning iteration id: ${iterationId}`)
  }

  for (let index = 0; index < lines.length - 1; index += 1) {
    const header = parseMarkdownTableCells(lines[index] ?? '')
    const separator = parseMarkdownTableCells(lines[index + 1] ?? '')
    if (
      header === null ||
      separator === null ||
      header.length !== separator.length ||
      !isMarkdownTableSeparator(separator)
    ) {
      continue
    }

    const rows = []
    let rowIndex = index + 2
    for (; rowIndex < lines.length; rowIndex += 1) {
      const cells = parseMarkdownTableCells(lines[rowIndex] ?? '')
      if (cells === null) break
      rows.push({ cells, lineIndex: rowIndex })
    }
    const candidateRows = rows.filter(({ cells }) => isTestCaseCandidate(cells))
    if (candidateRows.length === 0) {
      index = Math.max(index, rowIndex - 1)
      continue
    }
    for (const row of candidateRows) consumedCandidates.add(row.lineIndex)

    const roles = header.map((cell) => HEADER_ROLES.get(normalizeHeaderCell(cell)) ?? null)
    const hasTaskOwnership = roles.includes('task')
    if (hasTaskOwnership) {
      errors.push('iteration test tables must not contain a task ownership column')
    }

    const tableKind = arraysEqual(roles, AUTOMATED_HEADER_ROLES)
      ? 'TC'
      : arraysEqual(roles, MANUAL_HEADER_ROLES)
        ? 'MAN'
        : null
    if (tableKind === null) {
      errors.push('test cases require a recognized iteration test table header')
    }

    for (const { cells } of candidateRows) {
      const candidate = cells[0] ?? ''
      const taskId = cells.find((cell) => /^M\d+-T\d{2}$/.test(cell))
      if (taskId !== undefined) {
        errors.push(`iteration test table contains task-level id: ${taskId}`)
      }
      const kind = validateTestCaseId(candidate, iterationId, seen, errors)
      if (kind === null || tableKind === null || hasTaskOwnership || taskId !== undefined) continue
      if (kind !== tableKind) {
        errors.push(`${candidate} is in the wrong iteration test table type`)
        continue
      }
      if (cells.length !== header.length) {
        errors.push(`${candidate} does not contain all required table fields`)
        continue
      }

      let hasEmptyField = false
      for (const [cellIndex, cell] of cells.entries()) {
        if (cell.length > 0) continue
        errors.push(`${candidate} field ${header[cellIndex]} must be non-empty`)
        hasEmptyField = true
      }
      if (hasEmptyField) continue

      seen.add(candidate)
      if (kind === 'TC') automated.push(candidate)
      else manual.push(candidate)
    }

    index = Math.max(index, rowIndex - 1)
  }

  for (const [index, line] of lines.entries()) {
    const cells = parseMarkdownTableCells(line)
    if (cells !== null && isTestCaseCandidate(cells) && !consumedCandidates.has(index)) {
      errors.push(`${cells[0]} is outside a recognized Markdown test table`)
    }
  }

  return { automated, manual, errors }
}
