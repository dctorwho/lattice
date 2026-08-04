import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, test } from 'vitest'

import {
  collectReferenceIds,
  parseIterationTestCases,
  validateIterationState
} from '../../../scripts/planning/iteration-model.mjs'

type Status = 'blocked' | 'ready' | 'in_progress' | 'awaiting_manual' | 'passed' | 'failed'

interface MutableEvidence {
  kind: 'command' | 'test' | 'report' | 'manual'
  summary: string
  path?: string
  recorded_at: string
}

interface MutableIteration {
  id: string
  status: Status
  depends_on: string[]
  manual_gate: boolean
  entry: {
    requirements: string
    detailed_design: string
    test_cases: string
  }
  exit: {
    test_report: string
    iteration_report: string
  }
  evidence: MutableEvidence[]
}

interface MutableState {
  schema_version: number
  product_baseline: string
  current_iteration: string
  allowed_statuses: Status[]
  iterations: MutableIteration[]
}

const iterationFolders = [
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

const statuses: Status[] = [
  'blocked',
  'ready',
  'in_progress',
  'awaiting_manual',
  'passed',
  'failed'
]

const manualGateIterations = new Set(['M0', 'M1', 'M2', 'M5', 'M6', 'M8'])

const makeIteration = (index: number): MutableIteration => {
  const id = `M${index}`
  const folder = iterationFolders[index]
  if (folder === undefined) throw new Error(`missing fixture folder for ${id}`)

  return {
    id,
    status: index === 0 ? 'in_progress' : 'blocked',
    depends_on: index === 0 ? [] : [`M${index - 1}`],
    manual_gate: manualGateIterations.has(id),
    entry: {
      requirements: `iterations/${folder}/01-requirements.md`,
      detailed_design: `iterations/${folder}/02-detailed-design.md`,
      test_cases: `iterations/${folder}/03-test-cases.md`
    },
    exit: {
      test_report: `iterations/${folder}/04-test-report.md`,
      iteration_report: `iterations/${folder}/05-exit-report.md`
    },
    evidence: []
  }
}

const makeValidState = (): MutableState => ({
  schema_version: 2,
  product_baseline: 'Typora 1.13.8 documented feature compatibility',
  current_iteration: 'M0',
  allowed_statuses: [...statuses],
  iterations: Array.from({ length: 9 }, (_, index) => makeIteration(index))
})

const schema: unknown = JSON.parse(
  readFileSync(join(process.cwd(), 'iterations/state.schema.json'), 'utf8')
)

const cloneState = (): MutableState => structuredClone(makeValidState())

const markPassed = (state: MutableState, index: number): void => {
  const iteration = state.iterations[index]
  if (iteration === undefined) throw new Error(`missing fixture iteration M${index}`)
  iteration.status = 'passed'
  if (iteration.manual_gate) {
    iteration.evidence.push({
      kind: 'manual',
      summary: `${iteration.id} manual gate passed`,
      recorded_at: '2026-08-04T01:02:03Z'
    })
  }
}

const expectError = (errors: readonly string[], fragment: string): void => {
  expect(
    errors.some((error) => error.includes(fragment)),
    errors.join('\n')
  ).toBe(true)
}

describe('validateIterationState', () => {
  test('accepts the complete M0-M8 linear state', () => {
    expect(validateIterationState(makeValidState(), schema)).toEqual([])
  })

  test('ships an initial state that keeps only M0 active and later iterations blocked', () => {
    const initialState: unknown = JSON.parse(
      readFileSync(join(process.cwd(), 'iterations/state.json'), 'utf8')
    )

    expect(validateIterationState(initialState, schema)).toEqual([])
    expect(initialState).toEqual(makeValidState())
  })

  test.each(['M0', 'M1', 'M2', 'M5', 'M6', 'M8'])(
    'does not allow the mandatory %s manual gate to be disabled',
    (iterationId) => {
      const state = cloneState()
      const iteration = state.iterations.find((candidate) => candidate.id === iterationId)
      if (iteration === undefined) throw new Error(`missing fixture iteration ${iterationId}`)
      iteration.manual_gate = false

      expectError(validateIterationState(state, schema), `${iterationId} manual_gate is mandatory`)
    }
  )

  test.each([
    ['missing M8', (state: MutableState) => state.iterations.pop()],
    [
      'duplicate M7',
      (state: MutableState) => {
        state.iterations[8] = structuredClone(state.iterations[7]!)
      }
    ],
    [
      'out-of-range M9',
      (state: MutableState) => {
        state.iterations[8]!.id = 'M9'
      }
    ],
    [
      'task-level M0-T01',
      (state: MutableState) => {
        state.iterations[0]!.id = 'M0-T01'
      }
    ]
  ])('rejects an incomplete or invalid ID set: %s', (_name, mutate) => {
    const state = cloneState()
    mutate(state)

    expectError(validateIterationState(state, schema), 'iteration id')
  })

  test.each([
    [
      'unknown top-level property',
      (state: MutableState) => Object.assign(state, { current_task: null }),
      'unsupported property'
    ],
    [
      'unknown iteration property',
      (state: MutableState) => Object.assign(state.iterations[0]!, { owner: 'agent' }),
      'unsupported property'
    ],
    [
      'unknown entry property',
      (state: MutableState) => Object.assign(state.iterations[0]!.entry, { plan: 'plan.md' }),
      'unsupported property'
    ],
    [
      'unknown exit property',
      (state: MutableState) => Object.assign(state.iterations[0]!.exit, { summary: 'done.md' }),
      'unsupported property'
    ],
    [
      'unknown evidence property',
      (state: MutableState) => {
        state.iterations[0]!.evidence.push({
          kind: 'test',
          summary: 'focused checks passed',
          recorded_at: '2026-08-04T01:02:03Z'
        })
        Object.assign(state.iterations[0]!.evidence[0]!, { raw_output: 'secret' })
      },
      'unsupported property'
    ]
  ])('fails closed on %s', (_name, mutate, errorFragment) => {
    const state = cloneState()
    mutate(state)

    expectError(validateIterationState(state, schema), errorFragment)
  })

  test('rejects a supplied schema with its nested definitions removed', () => {
    const mutatedSchema: unknown = structuredClone(schema)
    if (mutatedSchema === null || typeof mutatedSchema !== 'object') {
      throw new Error('schema fixture must be an object')
    }
    Reflect.deleteProperty(mutatedSchema, '$defs')

    expectError(
      validateIterationState(makeValidState(), mutatedSchema),
      'schema top-level contract mismatch'
    )
  })

  test('rejects a supplied schema whose nested evidence object is no longer closed', () => {
    const mutatedSchema: unknown = structuredClone(schema)
    if (mutatedSchema === null || typeof mutatedSchema !== 'object') {
      throw new Error('schema fixture must be an object')
    }
    const definitions: unknown = Reflect.get(mutatedSchema, '$defs')
    if (definitions === null || typeof definitions !== 'object') {
      throw new Error('schema fixture must contain definitions')
    }
    const evidenceDefinition: unknown = Reflect.get(definitions, 'evidence')
    if (evidenceDefinition === null || typeof evidenceDefinition !== 'object') {
      throw new Error('schema fixture must contain the evidence definition')
    }
    Reflect.set(evidenceDefinition, 'additionalProperties', true)

    expectError(
      validateIterationState(makeValidState(), mutatedSchema),
      'schema evidence.additionalProperties contract mismatch'
    )
  })

  test('rejects an unreviewed constraint on a top-level string schema', () => {
    const mutatedSchema: unknown = structuredClone(schema)
    if (mutatedSchema === null || typeof mutatedSchema !== 'object') {
      throw new Error('schema fixture must be an object')
    }
    const properties: unknown = Reflect.get(mutatedSchema, 'properties')
    if (properties === null || typeof properties !== 'object') {
      throw new Error('schema fixture must contain properties')
    }
    const baselineDefinition: unknown = Reflect.get(properties, 'product_baseline')
    if (baselineDefinition === null || typeof baselineDefinition !== 'object') {
      throw new Error('schema fixture must contain the product baseline definition')
    }
    Reflect.set(baselineDefinition, 'maxLength', 1)

    expectError(
      validateIterationState(makeValidState(), mutatedSchema),
      'schema product_baseline contract mismatch'
    )
  })

  test('rejects an unreviewed constraint on a nested evidence field schema', () => {
    const mutatedSchema: unknown = structuredClone(schema)
    if (mutatedSchema === null || typeof mutatedSchema !== 'object') {
      throw new Error('schema fixture must be an object')
    }
    const definitions: unknown = Reflect.get(mutatedSchema, '$defs')
    if (definitions === null || typeof definitions !== 'object') {
      throw new Error('schema fixture must contain definitions')
    }
    const evidenceDefinition: unknown = Reflect.get(definitions, 'evidence')
    if (evidenceDefinition === null || typeof evidenceDefinition !== 'object') {
      throw new Error('schema fixture must contain the evidence definition')
    }
    const evidenceProperties: unknown = Reflect.get(evidenceDefinition, 'properties')
    if (evidenceProperties === null || typeof evidenceProperties !== 'object') {
      throw new Error('schema fixture must contain evidence properties')
    }
    const summaryDefinition: unknown = Reflect.get(evidenceProperties, 'summary')
    if (summaryDefinition === null || typeof summaryDefinition !== 'object') {
      throw new Error('schema fixture must contain the evidence summary definition')
    }
    Reflect.set(summaryDefinition, 'maxLength', 1)

    expectError(
      validateIterationState(makeValidState(), mutatedSchema),
      'schema evidence.summary contract mismatch'
    )
  })

  test('rejects an unreviewed constraint on a role-path schema', () => {
    const mutatedSchema: unknown = structuredClone(schema)
    if (mutatedSchema === null || typeof mutatedSchema !== 'object') {
      throw new Error('schema fixture must be an object')
    }
    const definitions: unknown = Reflect.get(mutatedSchema, '$defs')
    if (definitions === null || typeof definitions !== 'object') {
      throw new Error('schema fixture must contain definitions')
    }
    const entryDefinition: unknown = Reflect.get(definitions, 'entry')
    if (entryDefinition === null || typeof entryDefinition !== 'object') {
      throw new Error('schema fixture must contain the entry definition')
    }
    const entryProperties: unknown = Reflect.get(entryDefinition, 'properties')
    if (entryProperties === null || typeof entryProperties !== 'object') {
      throw new Error('schema fixture must contain entry properties')
    }
    const requirementsDefinition: unknown = Reflect.get(entryProperties, 'requirements')
    if (requirementsDefinition === null || typeof requirementsDefinition !== 'object') {
      throw new Error('schema fixture must contain the requirements role definition')
    }
    Reflect.set(requirementsDefinition, 'maxLength', 1)

    expectError(
      validateIterationState(makeValidState(), mutatedSchema),
      'schema entry.requirements contract mismatch'
    )
  })

  test('applies the schema colon ban to runtime evidence paths', () => {
    const state = cloneState()
    state.iterations[0]!.evidence.push({
      kind: 'report',
      summary: 'A report path must use portable repository syntax',
      path: 'reports/foo:bar.md',
      recorded_at: '2026-08-04T01:02:03Z'
    })

    expectError(validateIterationState(state, schema), 'path must be repository-relative')
  })

  test.each([
    [
      'absolute path',
      (state: MutableState) => {
        state.iterations[0]!.entry.requirements = 'C:/tmp/01-requirements.md'
      },
      'repository-relative'
    ],
    [
      'parent traversal',
      (state: MutableState) => {
        state.iterations[0]!.entry.requirements = 'iterations/M0-foundation/../01-requirements.md'
      },
      'repository-relative'
    ],
    [
      'backslash path',
      (state: MutableState) => {
        state.iterations[0]!.entry.requirements = 'iterations\\M0-foundation\\01-requirements.md'
      },
      'repository-relative'
    ],
    [
      'another iteration directory',
      (state: MutableState) => {
        state.iterations[0]!.entry.requirements = 'iterations/M1-document-core/01-requirements.md'
      },
      'owning iteration directory'
    ],
    [
      'wrong role filename',
      (state: MutableState) => {
        state.iterations[0]!.exit.test_report = 'iterations/M0-foundation/test-report.md'
      },
      '04-test-report.md'
    ]
  ])('rejects malformed planning paths: %s', (_name, mutate, errorFragment) => {
    const state = cloneState()
    mutate(state)

    expectError(validateIterationState(state, schema), errorFragment)
  })

  test.each([
    [
      'dependency cycle',
      (state: MutableState) => {
        state.iterations[0]!.depends_on = ['M1']
      },
      'dependency cycle'
    ],
    [
      'self-dependency',
      (state: MutableState) => {
        state.iterations[1]!.depends_on = ['M1']
      },
      'depends on itself'
    ],
    [
      'unknown dependency',
      (state: MutableState) => {
        state.iterations[1]!.depends_on = ['M9']
      },
      'unknown iteration M9'
    ]
  ])('rejects %s', (_name, mutate, errorFragment) => {
    const state = cloneState()
    mutate(state)

    expectError(validateIterationState(state, schema), errorFragment)
  })

  test('rejects more than one active iteration', () => {
    const state = cloneState()
    state.iterations[1]!.status = 'awaiting_manual'

    expectError(validateIterationState(state, schema), 'at most one active iteration')
  })

  test('keeps current_iteration aligned with the active frontier', () => {
    const state = cloneState()
    state.current_iteration = 'M1'

    expectError(
      validateIterationState(state, schema),
      'current_iteration must identify M0 frontier'
    )
  })

  test('keeps current_iteration aligned with the ready frontier', () => {
    const state = cloneState()
    markPassed(state, 0)
    state.iterations[1]!.status = 'ready'
    state.current_iteration = 'M1'
    expect(validateIterationState(state, schema)).toEqual([])

    state.current_iteration = 'M0'
    expectError(
      validateIterationState(state, schema),
      'current_iteration must identify M1 frontier'
    )
  })

  test('keeps current_iteration aligned with the failed frontier', () => {
    const state = cloneState()
    markPassed(state, 0)
    state.iterations[1]!.status = 'failed'
    state.iterations[1]!.evidence.push({
      kind: 'test',
      summary: 'M1 automated gate failed',
      recorded_at: '2026-08-04T01:02:03Z'
    })
    state.current_iteration = 'M1'
    expect(validateIterationState(state, schema)).toEqual([])

    state.current_iteration = 'M0'
    expectError(
      validateIterationState(state, schema),
      'current_iteration must identify M1 frontier'
    )
  })

  test('uses M8 as current_iteration after every iteration has passed', () => {
    const state = cloneState()
    for (let index = 0; index < state.iterations.length; index += 1) markPassed(state, index)
    state.current_iteration = 'M8'
    expect(validateIterationState(state, schema)).toEqual([])

    state.current_iteration = 'M7'
    expectError(
      validateIterationState(state, schema),
      'current_iteration must identify M8 frontier'
    )
  })

  test('rejects a blocked iteration as soon as all of its dependencies have passed', () => {
    const state = cloneState()
    state.iterations[0]!.status = 'passed'
    state.iterations[0]!.evidence.push({
      kind: 'manual',
      summary: 'M0 manual gate passed',
      recorded_at: '2026-08-04T01:02:03Z'
    })

    expectError(validateIterationState(state, schema), 'M1 is blocked despite passed dependencies')
  })

  test('requires failed iterations to retain non-empty failure evidence', () => {
    const state = cloneState()
    state.iterations[0]!.status = 'failed'

    expectError(validateIterationState(state, schema), 'M0 failed status requires failure evidence')

    state.iterations[0]!.evidence.push({
      kind: 'test',
      summary: 'The iteration gate failed and remains under investigation',
      recorded_at: '2026-08-04T01:02:03Z'
    })
    expect(validateIterationState(state, schema)).toEqual([])
  })

  test('requires passed manual gates to carry manual evidence and both exit paths', () => {
    const state = cloneState()
    state.iterations[0]!.status = 'passed'
    state.iterations[0]!.exit.test_report = ''
    state.iterations[0]!.exit.iteration_report = ''

    const errors = validateIterationState(state, schema)

    expectError(errors, 'manual evidence')
    expectError(errors, '04-test-report.md')
    expectError(errors, '05-exit-report.md')
  })

  test('rejects invalid RFC 3339 evidence timestamps', () => {
    const state = cloneState()
    state.iterations[0]!.evidence.push({
      kind: 'test',
      summary: 'invalid calendar date must not be accepted',
      recorded_at: '2026-02-30T00:00:00Z'
    })

    expectError(validateIterationState(state, schema), 'RFC 3339')
  })

  test.each([
    '2026-08-04t01:02:03z',
    '2026-08-04T01:02:03.123456+05:30',
    '1990-12-31T23:59:60Z',
    '1990-12-31T15:59:60-08:00'
  ])('accepts standards-conformant RFC 3339 evidence time %s', (recordedAt) => {
    const state = cloneState()
    state.iterations[0]!.evidence.push({
      kind: 'test',
      summary: 'The timestamp is valid RFC 3339 evidence',
      recorded_at: recordedAt
    })

    expect(validateIterationState(state, schema)).toEqual([])
  })

  test.each(['2026-02-01T12:00:60Z', '1990-12-31T23:58:60Z', '2026-04-31T01:02:03Z'])(
    'rejects context-invalid RFC 3339 evidence time %s',
    (recordedAt) => {
      const state = cloneState()
      state.iterations[0]!.evidence.push({
        kind: 'test',
        summary: 'The timestamp is not valid RFC 3339 evidence',
        recorded_at: recordedAt
      })

      expectError(validateIterationState(state, schema), 'RFC 3339')
    }
  )
})

describe('collectReferenceIds', () => {
  test('expands compact and fully-qualified ranges in deterministic source order', () => {
    const ids = collectReferenceIds(
      'DOC-001..003, COMP-036, DOC-005..DOC-007, IGNORED-001',
      new Set(['DOC', 'COMP'])
    )

    expect([...ids]).toEqual([
      'DOC-001',
      'DOC-002',
      'DOC-003',
      'COMP-036',
      'DOC-005',
      'DOC-006',
      'DOC-007'
    ])
  })

  test('does not expand reversed or cross-prefix ranges', () => {
    const ids = collectReferenceIds('DOC-008..001 DOC-001..COMP-003', new Set(['DOC', 'COMP']))

    expect([...ids]).toEqual([])
  })

  test('expands the full bounded three-digit requirement range without silent loss', () => {
    const ids = [...collectReferenceIds('DOC-001..999', new Set(['DOC']))]

    expect(ids).toHaveLength(999)
    expect(ids[0]).toBe('DOC-001')
    expect(ids[500]).toBe('DOC-501')
    expect(ids[998]).toBe('DOC-999')
  })
})

describe('parseIterationTestCases', () => {
  const tableHeader = `| ID | 覆盖能力 | 层级/级别 | 数据/环境 | 步骤 | 预期 | 自动化 |
| --- | --- | --- | --- | --- | --- | --- |`

  test('parses iteration-owned automated and manual rows without a task column', () => {
    const markdown = `${tableHeader}
| TC-M2-001 | 源码事务 | unit/P0 | EDIT-M2 | 编辑 | 仅改目标范围 | \`pnpm test -- tests/unit/editor.spec.ts\` |

| ID | 覆盖能力 | 环境 | 步骤 | 预期 | 证据 |
| --- | --- | --- | --- | --- | --- |
| MAN-M2-001 | 中文输入 | Windows 11 | 输入 | 无重复文字 | 录屏 |`

    expect(parseIterationTestCases(markdown, 'M2')).toEqual({
      automated: ['TC-M2-001'],
      manual: ['MAN-M2-001'],
      errors: []
    })
  })

  test('rejects duplicate IDs and IDs owned by another iteration', () => {
    const markdown = `${tableHeader}
| TC-M1-001 | 打开 | unit/P1 | DATA | 打开 | 成功 | \`pnpm test -- tests/unit/open.spec.ts\` |
| TC-M1-001 | 保存 | unit/P1 | DATA | 保存 | 成功 | \`pnpm test -- tests/unit/save.spec.ts\` |
| MAN-M2-001 | 输入 | Windows | 输入 | 成功 | 录屏 |`

    const result = parseIterationTestCases(markdown, 'M1')

    expect(result.automated).toEqual(['TC-M1-001'])
    expect(result.manual).toEqual([])
    expectError(result.errors, 'duplicate test case id: TC-M1-001')
    expectError(result.errors, 'MAN-M2-001 belongs to M2, not M1')
  })

  test.each([
    [
      'tc-M0-001',
      `${tableHeader}
| tc-M0-001 | bootstrap | unit/P1 | ENV | run | pass | command |`
    ],
    [
      'mAn-M0-001',
      `| ID | 覆盖能力 | 环境 | 步骤 | 通过条件 | 证据 |
| --- | --- | --- | --- | --- | --- |
| mAn-M0-001 | IME | Windows 11 | input | stable text | recording |`
    ]
  ])('rejects non-canonical case spelling as malformed: %s', (caseId, markdown) => {
    const result = parseIterationTestCases(markdown, 'M0')

    expect(result.automated).toEqual([])
    expect(result.manual).toEqual([])
    expectError(result.errors, `malformed test case id: ${caseId}`)
  })

  test.each([
    [
      'a lone pipe-delimited row',
      '| TC-M0-001 | capability | unit/P0 | fixture | step | expected | command |'
    ],
    [
      'a header without its Markdown separator',
      `| ID | 覆盖能力 | 层级/级别 | 数据/环境 | 步骤 | 预期 | 自动化 |
| TC-M0-001 | capability | unit/P0 | fixture | step | expected | command |`
    ]
  ])('rejects %s outside a recognized Markdown test table', (_name, markdown) => {
    const result = parseIterationTestCases(markdown, 'M0')

    expect(result.automated).toEqual([])
    expectError(result.errors, 'outside a recognized Markdown test table')
  })

  test.each([
    [
      'automated capability',
      `${tableHeader}
| TC-M0-001 | | unit/P0 | fixture | step | expected | command |`,
      'TC-M0-001 field 覆盖能力 must be non-empty'
    ],
    [
      'manual evidence',
      `| ID | 覆盖能力 | 环境 | 步骤 | 通过条件 | 证据 |
| --- | --- | --- | --- | --- | --- |
| MAN-M0-001 | IME | Windows 11 | input | stable text | |`,
      'MAN-M0-001 field 证据 must be non-empty'
    ]
  ])('rejects an empty %s field', (_name, markdown, errorFragment) => {
    const result = parseIterationTestCases(markdown, 'M0')

    expect(result.automated).toEqual([])
    expect(result.manual).toEqual([])
    expectError(result.errors, errorFragment)
  })

  test.each(['任务', 'Task', 'Task owner'])(
    'rejects the semantic %s ownership column',
    (taskHeader) => {
      const markdown = `| ID | ${taskHeader} | 覆盖能力 | 层级/级别 | 数据/环境 | 步骤 | 预期 | 自动化 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TC-M0-001 | M0-T01 | bootstrap | integration/P1 | ENV | install | success | command |`

      const result = parseIterationTestCases(markdown, 'M0')

      expect(result.automated).toEqual([])
      expectError(result.errors, 'task ownership column')
    }
  )

  test('rejects legacy task columns and malformed case IDs', () => {
    const markdown = `| ID | 任务 | 覆盖能力 | 层级/级别 | 数据/环境 | 步骤 | 预期 | 自动化 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TC-M0-001 | M0-T01 | 自举 | integration/P1 | ENV | 安装 | 成功 | \`pnpm test:integration\` |
| TC-M0-1 | 无效 | unit/P1 | DATA | 执行 | 失败 | \`pnpm test\` |`

    const result = parseIterationTestCases(markdown, 'M0')

    expectError(result.errors, 'task ownership column')
    expectError(result.errors, 'task-level id')
    expectError(result.errors, 'malformed test case id: TC-M0-1')
  })
})
