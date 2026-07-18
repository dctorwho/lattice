# M0-T02 Quality Toolchain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a real, failure-sensitive, repeatable quality toolchain for M0-T02 and automate the M0-T01 bootstrap acceptance without making the daily gate depend on the network.

**Architecture:** `pnpm check` remains an offline daily gate composed of format, lint, strict typecheck, unit/component tests, integration tests, and production build. Bootstrap verification is split into an offline TC-M0-001 regression and an explicit network-enabled TC-M0-008 cold-bootstrap gate; TC-M0-002 runs in isolated temporary copies and uses a child-only environment guard to prevent recursive meta-testing.

**Tech Stack:** pnpm 11.12.0, Node 24, TypeScript 5.9.3, ESLint 10.7.0, Prettier 3.9.5, Vitest 4.1.10, Testing Library, Playwright 1.61.1, Electron 43.1.1.

## Global Constraints

- Implement only M0-T02; M0-T03 security policies, M0-T06 CI/SBOM, editor, file services, commands, and business UI remain out of scope.
- Keep `pnpm-lock.yaml` as the only lockfile and use exact dependency versions; never use `latest` or a version range.
- `pnpm check` must not access the network and must contain `format:check`, `lint`, `typecheck`, `test`, `test:integration`, and `build`.
- `test:e2e`, `test:security`, `test:performance`, and `test:bootstrap:cold` are real explicit gates outside `check`.
- Temporary project tests must exclude `.git`, `node_modules`, `out`, stores, reports, coverage, and `.superpowers`, use `shell: false`, enforce timeouts, and clean up in `finally`.
- `LATTICE_QUALITY_META_CHILD=1` may exclude only `tests/integration/quality-scripts.spec.ts` from a nested integration run; the normal parent run must always include it.
- Renderer security smoke is limited to the existing `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`, and unavailable Node/Electron globals; full policy testing stays in M0-T03.
- Performance smoke validates the measurement and threshold harness only; it does not claim product NFR performance.
- M0-T02 has no manual gate. If an automated Electron launch cannot run, record failure or an environment blocker rather than substituting an informal manual observation.
- Use non-destructive patches, preserve unrelated changes, and never use `git reset --hard`.

## File Map

| File                                                   | Responsibility                                                                  |
| ------------------------------------------------------ | ------------------------------------------------------------------------------- |
| `tasks/state.json`                                     | Select M0-T02, record status and final evidence, unlock only M0-T03 when passed |
| `tasks/M0-foundation.md`                               | Complete M0-T02 Definition of Ready and acceptance contract                     |
| `docs/04-technology-stack.md`                          | Freeze exact quality-tool versions, licenses, scripts, and scope                |
| `docs/09-test-strategy.md`                             | Define daily versus explicit gates and recursion/cold-bootstrap policy          |
| `docs/test-cases/M0-foundation.md`                     | Refine TC-M0-001/002 and add TC-M0-008                                          |
| `package.json`, `pnpm-lock.yaml`                       | Exact dependencies and stable command contract                                  |
| `eslint.config.mjs`                                    | Flat ESLint rules for JavaScript, TypeScript, React Hooks, and React Refresh    |
| `prettier.config.mjs`, `.prettierignore`               | Deterministic formatting and fixture/generated-file exclusions                  |
| `tsconfig.test.json`                                   | Strict typecheck for configs, helpers, and tests                                |
| `vitest.config.ts`                                     | Unit/component suite and coverage                                               |
| `vitest.integration.config.ts`                         | Integration suite and child-only meta-test exclusion                            |
| `vitest.bootstrap.config.ts`                           | Explicit cold-bootstrap suite                                                   |
| `vitest.performance.config.ts`                         | Performance-harness suite                                                       |
| `playwright.config.ts`                                 | Electron launch smoke                                                           |
| `playwright.security.config.ts`                        | M0-T02 renderer-boundary smoke                                                  |
| `tests/setup.ts`                                       | Testing Library DOM matchers and cleanup                                        |
| `tests/helpers/command.ts`                             | Timeout-aware, `shell:false` child process runner and pnpm invocation           |
| `tests/helpers/project-copy.ts`                        | Safe tracked-file copy and retrying cleanup                                     |
| `tests/helpers/artifacts.ts`                           | Lockfile and deterministic build-artifact assertions                            |
| `tests/helpers/bootstrap-project.ts`                   | Shared offline/cold bootstrap workflow                                          |
| `tests/helpers/performance.ts`                         | Median, P95, and threshold evaluation                                           |
| `tests/unit/app.smoke.spec.tsx`                        | Existing React bootstrap behavior                                               |
| `tests/unit/helpers/*.spec.ts`                         | Helper behavior, timeout, cleanup, hashing, and metrics                         |
| `tests/integration/project-bootstrap.spec.ts`          | Offline TC-M0-001 regression                                                    |
| `tests/integration/quality-scripts.spec.ts`            | TC-M0-002 positive and fault-injection matrix                                   |
| `tests/bootstrap/project-cold-bootstrap.spec.ts`       | Network-enabled TC-M0-008                                                       |
| `tests/e2e/app-launch.spec.ts`                         | Real Electron startup and close                                                 |
| `tests/security/electron-boundary.smoke.spec.ts`       | Current renderer privilege boundary                                             |
| `tests/performance/harness.smoke.spec.ts`              | Measurement harness behavior                                                    |
| `docs/evidence/M0-T02-quality-toolchain-2026-07-18.md` | Commands, exits, counts, hashes, cleanup, and residual risks                    |

---

### Task 1: Make M0-T02 Ready and Select It

**Files:**

- Modify: `tasks/state.json`
- Modify: `tasks/M0-foundation.md`
- Modify: `docs/04-technology-stack.md`
- Modify: `docs/09-test-strategy.md`
- Modify: `docs/test-cases/M0-foundation.md`

**Interfaces:**

- Consumes: approved design `docs/superpowers/specs/2026-07-18-m0-t02-quality-readiness-design.md`
- Produces: complete M0-T02 task contract, stable TC-M0-008, and `current_task: "M0-T02"`

- [ ] **Step 1: Mark the selected task in progress before implementation**

Change only the task selector and M0-T02 entry:

```json
"current_task": "M0-T02"
```

```json
{
  "id": "M0-T02",
  "status": "in_progress",
  "depends_on": ["M0-T01"],
  "manual_gate": false,
  "evidence": []
}
```

Run: `node scripts/verify-planning-docs.mjs`

Expected: exit 0 and M0-T01 remains `passed`; M0-T03 remains `blocked`.

- [ ] **Step 2: Complete the M0-T02 Definition of Ready**

Replace the M0-T02 section in `tasks/M0-foundation.md` with a contract containing these exact decisions:

```markdown
## M0-T02 质量工具链

- 依赖：M0-T01
- 需求：NFR-008（本任务建立严格类型、可失败测试、临时项目隔离和后续可替换边界测试的基础，不声称产品文件系统、时钟、随机数、进程或对话框边界已经实现）
- 设计决策：`pnpm check` 是无网络日常门禁；TC-M0-001 复用已验证 store 做离线回归；TC-M0-008 单独验证空 store 联网自举；TC-M0-002 在临时项目副本中注入故障，并以 `LATTICE_QUALITY_META_CHILD=1` 只阻止元测试递归。
- 交付：strict TypeScript、ESLint、Prettier、Vitest、Testing Library、Playwright Electron；建立 `format/format:check/lint/typecheck/test/test:integration/test:e2e/test:security/test:performance/test:bootstrap:cold/build/check` 和真实 smoke tests。
- 预期文件：质量配置、`tests/helpers/`、单元/集成/E2E/安全/性能/冷自举用例、M0-T02 证据，以及同步的技术栈、测试策略和用例文档。
- 非目标：产品功能测试；M0-T03 的完整 Electron 安全策略；M0-T06 的 CI、SBOM 和完整依赖审计；产品性能达标声明。
- 自动验证：`pnpm check` 连续两次；`pnpm test:e2e`、`pnpm test:security`、`pnpm test:performance`、`pnpm test:bootstrap:cold`；格式、lint、类型、单元、集成和构建六类故障均使直接命令与 `pnpm check` 非零退出。
- 人工验证：不适用（`manual_gate:false`）；Electron 启动由自动 E2E 验证。
- 失败回退：保持任务 `in_progress`，通过可审阅补丁撤销本任务新增配置或依赖并保留 M0-T01 基线；不得弱化规则、删除用例或使用破坏性 Git 命令。
- 完成：命令、依赖、测试 ID 和文档一致；证据完整；状态设为 `passed` 并只解锁 M0-T03。
```

- [ ] **Step 3: Freeze the direct dependency and command policy**

Add exact rows to `docs/04-technology-stack.md` for:

```text
eslint 10.7.0; @eslint/js 10.0.1; typescript-eslint 8.64.0; globals 17.7.0;
eslint-plugin-react-hooks 7.1.1; eslint-plugin-react-refresh 0.5.3;
prettier 3.9.5; vitest 4.1.10; @vitest/coverage-v8 4.1.10;
jsdom 29.1.1; @testing-library/dom 10.4.1;
@testing-library/react 16.3.2; @testing-library/jest-dom 6.9.1;
@playwright/test 1.61.1.
```

Record MIT for all entries except `@playwright/test` (Apache-2.0), no runtime renderer exposure, and no implicit Playwright browser download. State that `check` is offline while cold bootstrap is explicit and network-enabled.

- [ ] **Step 4: Remove the test-contract contradictions**

In `docs/09-test-strategy.md` add `format`, `format:check`, and `test:bootstrap:cold`; explicitly define the child guard and state that the cold command is outside `check`.

In `docs/test-cases/M0-foundation.md`:

```markdown
| TC-M0-001 | M0-T01 | integration/P1 | ENV-M0-A with validated store and offline install; automated by M0-T02 | frozen offline install and two builds in a Chinese-and-space path | unique lockfile, no pending builds, stable artifact hashes, cleanup | `pnpm test:integration -- tests/integration/project-bootstrap.spec.ts` |
| TC-M0-002 | M0-T02 | integration/P1 | isolated temporary copies | run normal scripts; inject format, lint, type, unit, integration, and build faults | direct commands and guarded nested `check` fail correctly without recursion | `pnpm test:integration -- tests/integration/quality-scripts.spec.ts` |
| TC-M0-008 | M0-T02 | integration/P1 | Chinese-and-space path, empty project store, network allowed | frozen install and two builds | unique lockfile, no pending builds, stable artifacts, cleanup | `pnpm test:bootstrap:cold` |
```

Change ENV-M0-A so daily regression is offline. Define a separate ENV-M0-B for the empty-store network-enabled cold gate.

- [ ] **Step 5: Validate and commit the readiness corrections**

Run: `node scripts/verify-planning-docs.mjs`

Expected: exit 0 with all requirements/tasks/test IDs valid and M0-T02 selected.

Run: `git diff --check`

Expected: no output.

Commit:

```powershell
git add tasks/state.json tasks/M0-foundation.md docs/04-technology-stack.md docs/09-test-strategy.md docs/test-cases/M0-foundation.md
git commit -m "docs(M0-T02): resolve readiness review findings"
```

---

### Task 2: Install the Frozen Toolchain and Establish Configuration

**Files:**

- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `tsconfig.json`
- Create: `tsconfig.test.json`
- Create: `eslint.config.mjs`
- Create: `prettier.config.mjs`
- Create: `.prettierignore`
- Create: `vitest.config.ts`
- Create: `vitest.integration.config.ts`
- Create: `vitest.bootstrap.config.ts`
- Create: `vitest.performance.config.ts`
- Create: `playwright.config.ts`
- Create: `playwright.security.config.ts`
- Create: `tests/setup.ts`

**Interfaces:**

- Consumes: exact dependency list and command contract from Task 1
- Produces: stable quality commands and typed test/config compilation

- [ ] **Step 1: Install exact development dependencies**

Run exactly:

```powershell
pnpm add -D -E eslint@10.7.0 @eslint/js@10.0.1 typescript-eslint@8.64.0 globals@17.7.0 eslint-plugin-react-hooks@7.1.1 eslint-plugin-react-refresh@0.5.3 prettier@3.9.5 vitest@4.1.10 @vitest/coverage-v8@4.1.10 jsdom@29.1.1 @testing-library/dom@10.4.1 @testing-library/react@16.3.2 @testing-library/jest-dom@6.9.1 @playwright/test@1.61.1
```

Expected: exit 0; `package.json` contains exact strings; only `pnpm-lock.yaml` changes; `pnpm ignored-builds` reports none.

- [ ] **Step 2: Add the strict test TypeScript project**

Create `tsconfig.test.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["node", "vite/client", "vitest/globals", "@testing-library/jest-dom"],
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "useUnknownInCatchVariables": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["tests/**/*.ts", "tests/**/*.tsx", "vitest*.config.ts", "playwright*.config.ts"]
}
```

Append `{ "path": "./tsconfig.test.json" }` to `tsconfig.json#references`.

- [ ] **Step 3: Add ESLint flat configuration**

Create `eslint.config.mjs`:

```js
import eslint from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      'out/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      '.superpowers/**'
    ]
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh
    },
    rules: {
      ...reactHooks.configs.flat.recommended.rules,
      ...reactRefresh.configs.vite.rules,
      'no-debugger': 'error'
    }
  }
)
```

If ESLint reports that a config file is outside every TypeScript project, narrow the type-aware block to `src/**/*.{ts,tsx}` and `tests/**/*.{ts,tsx}`, then add a non-type-aware TypeScript block for `*.config.ts`; do not disable individual correctness rules to make lint green.

- [ ] **Step 4: Add deterministic formatting configuration**

Create `prettier.config.mjs`:

```js
export default {
  semi: false,
  singleQuote: true,
  trailingComma: 'none',
  printWidth: 100
}
```

Create `.prettierignore`:

```text
node_modules
out
coverage
playwright-report
test-results
.superpowers
pnpm-lock.yaml
tests/fixtures
docs/evidence
```

- [ ] **Step 5: Add Vitest suite boundaries**

Create `vitest.config.ts`:

```ts
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.spec.{ts,tsx}'],
    setupFiles: ['tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary']
    }
  }
})
```

Create `vitest.integration.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

const isMetaChild = process.env.LATTICE_QUALITY_META_CHILD === '1'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.spec.ts'],
    exclude: isMetaChild ? ['tests/integration/quality-scripts.spec.ts'] : [],
    testTimeout: 180_000,
    hookTimeout: 180_000,
    sequence: { concurrent: false }
  }
})
```

Create `vitest.bootstrap.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/bootstrap/**/*.spec.ts'],
    testTimeout: 600_000,
    hookTimeout: 600_000,
    maxWorkers: 1,
    minWorkers: 1
  }
})
```

Create `vitest.performance.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/performance/**/*.spec.ts'],
    testTimeout: 60_000,
    maxWorkers: 1,
    minWorkers: 1
  }
})
```

- [ ] **Step 6: Add Playwright suite boundaries**

Create `playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  workers: 1,
  timeout: 60_000,
  retries: 0,
  reporter: [['list']]
})
```

Create `playwright.security.config.ts`:

```ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/security',
  workers: 1,
  timeout: 60_000,
  retries: 0,
  reporter: [['list']]
})
```

Create `tests/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => cleanup())
```

- [ ] **Step 7: Add the stable package scripts**

Set `package.json#scripts` to include:

```json
{
  "dev": "electron --version && electron-vite dev",
  "start": "electron-vite preview",
  "format": "prettier --write .",
  "format:check": "prettier --check .",
  "lint": "eslint . --max-warnings=0",
  "typecheck": "tsc -p tsconfig.node.json --noEmit --composite false --incremental false && tsc -p tsconfig.web.json --noEmit --composite false --incremental false && tsc -p tsconfig.test.json --noEmit --incremental false",
  "test": "vitest run --config vitest.config.ts --coverage",
  "test:integration": "vitest run --config vitest.integration.config.ts",
  "test:e2e": "pnpm build && playwright test --config playwright.config.ts",
  "test:security": "pnpm build && playwright test --config playwright.security.config.ts",
  "test:performance": "vitest run --config vitest.performance.config.ts",
  "test:bootstrap:cold": "vitest run --config vitest.bootstrap.config.ts",
  "build": "electron-vite build",
  "check": "pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm test:integration && pnpm build"
}
```

- [ ] **Step 8: Establish the formatter baseline and verify configs fail honestly**

Run: `pnpm format`

Expected: exit 0; generated folders, lockfile, fixtures, and evidence remain untouched.

Run: `pnpm format:check`

Expected: exit 0.

Run: `pnpm lint`

Expected at this stage: either exit 0 or only concrete errors in files that the next tasks create/adjust; no configuration crash.

Run: `pnpm typecheck`

Expected at this stage: either exit 0 or only missing-test-file/import errors resolved by later tasks; no TypeScript project configuration error.

- [ ] **Step 9: Commit the frozen toolchain configuration**

```powershell
git add package.json pnpm-lock.yaml tsconfig.json tsconfig.test.json eslint.config.mjs prettier.config.mjs .prettierignore vitest.config.ts vitest.integration.config.ts vitest.bootstrap.config.ts vitest.performance.config.ts playwright.config.ts playwright.security.config.ts tests/setup.ts
git commit -m "build(M0-T02): add frozen quality toolchain"
```

---

### Task 3: Build Tested Process, Copy, Artifact, and Performance Helpers

**Files:**

- Create: `tests/helpers/command.ts`
- Create: `tests/helpers/project-copy.ts`
- Create: `tests/helpers/artifacts.ts`
- Create: `tests/helpers/performance.ts`
- Create: `tests/unit/helpers/command.spec.ts`
- Create: `tests/unit/helpers/project-copy.spec.ts`
- Create: `tests/unit/helpers/artifacts.spec.ts`
- Create: `tests/unit/helpers/performance.spec.ts`

**Interfaces:**

- Produces: `runCommand`, `pnpmCommand`, `listProjectFiles`, `copyProject`, `removeWithRetry`, `assertSingleLockfile`, `hashArtifacts`, `summarizeSamples`, `assertWithinThreshold`

- [ ] **Step 1: Write failing process-runner tests**

Create `tests/unit/helpers/command.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { runCommand } from '../../helpers/command'

describe('runCommand', () => {
  it('captures stdout and a zero exit', async () => {
    const result = await runCommand(process.execPath, ['-e', "process.stdout.write('ok')"], {
      cwd: process.cwd(),
      timeoutMs: 5_000
    })
    expect(result).toEqual({ exitCode: 0, stdout: 'ok', stderr: '', timedOut: false })
  })

  it('preserves a non-zero exit', async () => {
    const result = await runCommand(process.execPath, ['-e', 'process.exit(7)'], {
      cwd: process.cwd(),
      timeoutMs: 5_000
    })
    expect(result.exitCode).toBe(7)
    expect(result.timedOut).toBe(false)
  })

  it('terminates a timed-out command', async () => {
    const result = await runCommand(process.execPath, ['-e', 'setInterval(() => {}, 1_000)'], {
      cwd: process.cwd(),
      timeoutMs: 100
    })
    expect(result.timedOut).toBe(true)
  })
})
```

Run: `pnpm test -- tests/unit/helpers/command.spec.ts`

Expected: FAIL because `tests/helpers/command.ts` does not exist.

- [ ] **Step 2: Implement the process runner**

Create `tests/helpers/command.ts` with these public types and functions:

```ts
export interface CommandResult {
  readonly exitCode: number | null
  readonly stdout: string
  readonly stderr: string
  readonly timedOut: boolean
}

export interface RunCommandOptions {
  readonly cwd: string
  readonly env?: NodeJS.ProcessEnv
  readonly timeoutMs: number
}

export function runCommand(
  command: string,
  args: readonly string[],
  options: RunCommandOptions
): Promise<CommandResult>

export function pnpmCommand(args: readonly string[]): {
  readonly command: string
  readonly args: readonly string[]
}
```

Implement `runCommand` with `spawn(command, [...args], { cwd, env, shell: false, windowsHide: true })`, collect UTF-8 output, kill on timeout, and resolve only after `close`. Implement `pnpmCommand` with `process.execPath` plus `process.env.npm_execpath`; throw a clear error when `npm_execpath` is missing.

Run: `pnpm test -- tests/unit/helpers/command.spec.ts`

Expected: PASS, including non-zero exit and timeout.

- [ ] **Step 3: Write failing safe-copy and cleanup tests**

Create `tests/unit/helpers/project-copy.spec.ts`:

```ts
import { access, mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { copyProject, removeWithRetry } from '../../helpers/project-copy'

describe('project copy isolation', () => {
  let root: string
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'lattice-copy-'))
  })
  afterEach(async () => rm(root, { recursive: true, force: true }))

  it('copies only the supplied safe relative paths', async () => {
    const source = join(root, 'source')
    const target = join(root, 'target')
    await mkdir(join(source, 'src'), { recursive: true })
    await mkdir(join(source, 'node_modules'), { recursive: true })
    await writeFile(join(source, 'src/index.ts'), 'export {}\n')
    await writeFile(join(source, 'node_modules/secret'), 'excluded')

    await copyProject(source, target, ['src/index.ts'])

    await expect(access(join(target, 'src/index.ts'))).resolves.toBeUndefined()
    await expect(access(join(target, 'node_modules/secret'))).rejects.toThrow()
  })

  it('removes a copied tree', async () => {
    const target = join(root, 'target')
    await mkdir(target)
    await removeWithRetry(target)
    await expect(access(target)).rejects.toThrow()
  })
})
```

Run: `pnpm test -- tests/unit/helpers/project-copy.spec.ts`

Expected: FAIL because the helper does not exist.

- [ ] **Step 4: Implement safe copy and retrying cleanup**

Create `tests/helpers/project-copy.ts`:

```ts
export const excludedTopLevelNames = new Set([
  '.git',
  '.superpowers',
  'node_modules',
  'out',
  'coverage',
  'playwright-report',
  'test-results',
  '.pnpm-store'
])

export async function listProjectFiles(source: string): Promise<readonly string[]>
export async function copyProject(
  source: string,
  target: string,
  relativePaths: readonly string[]
): Promise<void>
export async function removeWithRetry(target: string, attempts?: number): Promise<void>
```

Implement `listProjectFiles` by running `git ls-files --cached --others --exclude-standard -z` with `shell: false`, splitting NUL-delimited relative paths, rejecting absolute/parent-traversal paths, and filtering `excludedTopLevelNames`. Implement `copyProject` by creating parent directories and using `copyFile` for only those paths; reject a target inside the source. Implement cleanup with `rm({ recursive: true, force: true })`, three attempts by default, and 100/250 ms backoff. Rethrow the last error with the exact target path.

Run: `pnpm test -- tests/unit/helpers/project-copy.spec.ts`

Expected: PASS and the test temp root no longer exists after `afterEach`.

- [ ] **Step 5: Write failing artifact tests and implement checks**

Create `tests/unit/helpers/artifacts.spec.ts` around this parameter matrix:

```ts
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { assertSingleLockfile, hashArtifacts, requiredArtifacts } from '../../helpers/artifacts'

describe('bootstrap artifacts', () => {
  let root: string
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'lattice-artifacts-'))
    await writeFile(join(root, 'pnpm-lock.yaml'), 'lockfileVersion: 9\n')
  })
  afterEach(async () => rm(root, { recursive: true, force: true }))

  it.each(['npm-shrinkwrap.json', 'package-lock.json', 'yarn.lock'])(
    'rejects %s beside pnpm-lock.yaml',
    async (name) => {
      await writeFile(join(root, name), '')
      await expect(assertSingleLockfile(root)).rejects.toThrow(name)
    }
  )

  it('hashes every required artifact deterministically', async () => {
    for (const relativePath of requiredArtifacts) {
      const target = join(root, relativePath)
      await mkdir(dirname(target), { recursive: true })
      await writeFile(target, relativePath)
    }
    const first = await hashArtifacts(root)
    const second = await hashArtifacts(root)
    expect(first).toEqual(second)
    expect(Object.keys(first)).toEqual([...requiredArtifacts])
  })

  it('changes only the rewritten artifact hash', async () => {
    for (const relativePath of requiredArtifacts) {
      const target = join(root, relativePath)
      await mkdir(dirname(target), { recursive: true })
      await writeFile(target, relativePath)
    }
    const before = await hashArtifacts(root)
    await writeFile(join(root, 'out/main/index.js'), 'changed')
    const after = await hashArtifacts(root)

    expect(after['out/main/index.js']).not.toBe(before['out/main/index.js'])
    expect(after['out/preload/index.cjs']).toBe(before['out/preload/index.cjs'])
    expect(after['out/renderer/index.html']).toBe(before['out/renderer/index.html'])
  })
})
```

Create `tests/helpers/artifacts.ts`:

```ts
export const requiredArtifacts = [
  'out/main/index.js',
  'out/preload/index.cjs',
  'out/renderer/index.html'
] as const

export async function assertSingleLockfile(root: string): Promise<void>
export async function hashArtifacts(root: string): Promise<Readonly<Record<string, string>>>
```

Use `createHash('sha256')`; throw messages that include the relative offending path, never a full environment dump.

Run: `pnpm test -- tests/unit/helpers/artifacts.spec.ts`

Expected: PASS.

- [ ] **Step 6: Write failing metric tests and implement the harness**

Create `tests/unit/helpers/performance.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { assertWithinThreshold, summarizeSamples } from '../../helpers/performance'

describe('performance statistics', () => {
  it('uses median and nearest-rank P95', () => {
    expect(summarizeSamples([1, 2, 3, 4, 100])).toEqual({
      median: 3,
      p95: 100,
      sampleCount: 5
    })
  })

  it.each([[], [-1], [Number.NaN], [Number.POSITIVE_INFINITY]])(
    'rejects invalid samples %j',
    (samples) => expect(() => summarizeSamples(samples)).toThrow()
  )

  it('reports threshold violations', () => {
    const summary = summarizeSamples([1, 2, 3, 4, 100])
    expect(() => assertWithinThreshold('fixture', summary, { median: 3, p95: 99 })).toThrow(
      /fixture.*p95.*100.*99/
    )
  })
})
```

Create `tests/helpers/performance.ts`:

```ts
export interface SampleSummary {
  readonly median: number
  readonly p95: number
  readonly sampleCount: number
}

export function summarizeSamples(samples: readonly number[]): SampleSummary
export function assertWithinThreshold(
  label: string,
  summary: SampleSummary,
  limits: { readonly median: number; readonly p95: number }
): void
```

Reject empty, negative, and non-finite samples. Sort a copy and use nearest-rank P95: index `Math.ceil(0.95 * n) - 1`.

Run: `pnpm test -- tests/unit/helpers/performance.spec.ts`

Expected: PASS with a threshold error that names the metric and actual/limit values.

- [ ] **Step 7: Run helper gates and commit**

Run: `pnpm test`

Expected: all helper tests pass and coverage summary is printed.

Run: `pnpm typecheck`

Expected: exit 0.

Run: `pnpm lint`

Expected: exit 0 with zero warnings.

Commit:

```powershell
git add tests/helpers tests/unit/helpers
git commit -m "test(M0-T02): add isolated quality helpers"
```

---

### Task 4: Add Real Unit, E2E, Security, and Performance Smoke Tests

**Files:**

- Create: `tests/unit/app.smoke.spec.tsx`
- Create: `tests/e2e/app-launch.spec.ts`
- Create: `tests/security/electron-boundary.smoke.spec.ts`
- Create: `tests/performance/harness.smoke.spec.ts`

**Interfaces:**

- Consumes: existing `App`, Playwright configs, and performance helper
- Produces: non-placeholder tests for every explicit M0-T02 suite

- [ ] **Step 1: Write and run the React smoke test**

Create `tests/unit/app.smoke.spec.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { App } from '../../src/renderer/src/app'

describe('M0-T02 renderer smoke', () => {
  it('renders the existing M0-T01 bootstrap status', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Lattice' })).toBeVisible()
    expect(screen.getByText('Project bootstrap ready')).toBeVisible()
  })
})
```

Run: `pnpm test -- tests/unit/app.smoke.spec.tsx`

Expected: PASS without changing product UI.

- [ ] **Step 2: Write and run the Electron launch smoke**

Create `tests/e2e/app-launch.spec.ts`:

```ts
import { _electron as electron, expect, test } from '@playwright/test'

test('M0-T02 launches and closes the production Electron window', async () => {
  const application = await electron.launch({ args: ['.'] })
  try {
    const page = await application.firstWindow()
    await expect(page.getByRole('heading', { name: 'Lattice' })).toBeVisible()
    await expect(page.getByText('Project bootstrap ready')).toBeVisible()
  } finally {
    await application.close()
  }
})
```

Run: `pnpm test:e2e`

Expected: build exits 0, one real Electron window test passes, and no Electron process remains.

- [ ] **Step 3: Write and run the scoped security smoke**

Create `tests/security/electron-boundary.smoke.spec.ts`:

```ts
import { _electron as electron, expect, test } from '@playwright/test'

test('M0-T02 preserves the current renderer privilege boundary', async () => {
  const application = await electron.launch({ args: ['.'] })
  try {
    const page = await application.firstWindow()
    const preferences = await application.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0]
      if (!window) throw new Error('Main window is missing')
      const values = window.webContents.getLastWebPreferences()
      return {
        sandbox: values.sandbox,
        contextIsolation: values.contextIsolation,
        nodeIntegration: values.nodeIntegration
      }
    })
    const globals = await page.evaluate(() => ({
      requireType: typeof Reflect.get(globalThis, 'require'),
      processType: typeof Reflect.get(globalThis, 'process'),
      electronType: typeof Reflect.get(globalThis, 'electron')
    }))

    expect(preferences).toEqual({
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    })
    expect(globals).toEqual({
      requireType: 'undefined',
      processType: 'undefined',
      electronType: 'undefined'
    })
  } finally {
    await application.close()
  }
})
```

Run: `pnpm test:security`

Expected: one security smoke passes; do not add CSP/navigation assertions reserved for M0-T03.

- [ ] **Step 4: Add the performance-harness smoke**

Create `tests/performance/harness.smoke.spec.ts`:

```ts
import { performance } from 'node:perf_hooks'
import { describe, expect, it } from 'vitest'
import { assertWithinThreshold, summarizeSamples } from '../helpers/performance'

describe('M0-T02 performance harness smoke', () => {
  it('summarizes deterministic in-memory work', () => {
    const samples = Array.from({ length: 25 }, () => {
      const startedAt = performance.now()
      Array.from({ length: 2_000 }, (_, index) => 2_000 - index).sort((left, right) => left - right)
      return performance.now() - startedAt
    })
    const summary = summarizeSamples(samples)

    expect(summary.sampleCount).toBe(25)
    expect(Number.isFinite(summary.median)).toBe(true)
    expect(Number.isFinite(summary.p95)).toBe(true)
    expect(summary.median).toBeGreaterThanOrEqual(0)
    expect(summary.p95).toBeGreaterThanOrEqual(0)
    assertWithinThreshold('harness-only-sort', summary, { median: 5_000, p95: 5_000 })
  })

  it('rejects a synthetic threshold violation', () => {
    expect(() =>
      assertWithinThreshold(
        'synthetic',
        { median: 10, p95: 30, sampleCount: 3 },
        { median: 9, p95: 29 }
      )
    ).toThrow(/synthetic/)
  })
})
```

Run: `pnpm test:performance`

Expected: PASS and no claim about product startup/editor performance appears in output.

- [ ] **Step 5: Run static gates and commit**

Run: `pnpm format:check`

Run: `pnpm lint`

Run: `pnpm typecheck`

Expected: all exit 0.

Commit:

```powershell
git add tests/unit/app.smoke.spec.tsx tests/e2e/app-launch.spec.ts tests/security/electron-boundary.smoke.spec.ts tests/performance/harness.smoke.spec.ts
git commit -m "test(M0-T02): add executable smoke suites"
```

---

### Task 5: Automate Offline and Cold Bootstrap Acceptance

**Files:**

- Create: `tests/helpers/bootstrap-project.ts`
- Create: `tests/unit/helpers/bootstrap-project.spec.ts`
- Create: `tests/integration/project-bootstrap.spec.ts`
- Create: `tests/bootstrap/project-cold-bootstrap.spec.ts`

**Interfaces:**

- Consumes: `runCommand`, `pnpmCommand`, `listProjectFiles`, `copyProject`, `removeWithRetry`, `assertSingleLockfile`, `hashArtifacts`
- Produces: `verifyBootstrap(options): Promise<BootstrapEvidence>` shared by TC-M0-001 and TC-M0-008

- [ ] **Step 1: Write failing bootstrap-workflow unit tests**

Create `tests/unit/helpers/bootstrap-project.spec.ts` with an injected `runCommand` replacement. Use this factory as the center of the test:

```ts
import { access, mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { runCommand } from '../../helpers/command'
import { requiredArtifacts } from '../../helpers/artifacts'
import { verifyBootstrap } from '../../helpers/bootstrap-project'

describe('verifyBootstrap', () => {
  let root: string
  let sourceRoot: string
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'lattice-bootstrap-unit-'))
    sourceRoot = join(root, 'source')
    await mkdir(sourceRoot)
    await writeFile(join(sourceRoot, 'pnpm-lock.yaml'), 'lockfileVersion: 9\n')
  })
  afterEach(async () => rm(root, { recursive: true, force: true }))

  function fakeRunner(options?: { failBuildNumber?: number; failInstall?: boolean }) {
    const calls: Array<{ readonly args: readonly string[]; readonly cwd: string }> = []
    let buildNumber = 0
    const run: typeof runCommand = async (_command, args, commandOptions) => {
      calls.push({ args, cwd: commandOptions.cwd })
      if (args.includes('install') && options?.failInstall) {
        return { exitCode: 8, stdout: '', stderr: 'injected install failure', timedOut: false }
      }
      if (args.includes('build')) {
        buildNumber += 1
        if (buildNumber === options?.failBuildNumber) {
          return { exitCode: 9, stdout: '', stderr: 'injected build failure', timedOut: false }
        }
        for (const relativePath of requiredArtifacts) {
          const target = join(commandOptions.cwd, relativePath)
          await mkdir(dirname(target), { recursive: true })
          await writeFile(target, relativePath)
        }
      }
      return { exitCode: 0, stdout: '', stderr: '', timedOut: false }
    }
    return { calls, run }
  }

  it('adds offline install flags and builds twice', async () => {
    const fake = fakeRunner()
    await verifyBootstrap({
      sourceRoot,
      tempParent: root,
      mode: 'offline',
      storeDirectory: join(root, 'store'),
      relativePaths: ['pnpm-lock.yaml'],
      run: fake.run
    })
    const install = fake.calls.find((call) => call.args.includes('install'))
    expect(install?.args).toEqual(expect.arrayContaining(['--offline', '--frozen-lockfile']))
    expect(fake.calls.filter((call) => call.args.includes('build'))).toHaveLength(2)
  })

  it('cleans the project copy after an injected second-build failure', async () => {
    const fake = fakeRunner({ failBuildNumber: 2 })
    await expect(
      verifyBootstrap({
        sourceRoot,
        tempParent: root,
        mode: 'cold',
        storeDirectory: join(root, 'empty-store'),
        relativePaths: ['pnpm-lock.yaml'],
        run: fake.run
      })
    ).rejects.toThrow(/build.*9/)
    const copiedRoot = fake.calls[0]?.cwd
    expect(copiedRoot).toBeDefined()
    await expect(access(copiedRoot as string)).rejects.toThrow()
  })

  it('omits offline mode for a cold install', async () => {
    const fake = fakeRunner()
    await verifyBootstrap({
      sourceRoot,
      tempParent: root,
      mode: 'cold',
      storeDirectory: join(root, 'empty-store'),
      relativePaths: ['pnpm-lock.yaml'],
      run: fake.run
    })
    const install = fake.calls.find((call) => call.args.includes('install'))
    expect(install?.args).not.toContain('--offline')
  })

  it('reports an install-stage exit code', async () => {
    const fake = fakeRunner({ failInstall: true })
    await expect(
      verifyBootstrap({
        sourceRoot,
        tempParent: root,
        mode: 'offline',
        storeDirectory: join(root, 'store'),
        relativePaths: ['pnpm-lock.yaml'],
        run: fake.run
      })
    ).rejects.toThrow(/install.*8/)
  })
})
```

Run: `pnpm test -- tests/unit/helpers/bootstrap-project.spec.ts`

Expected: FAIL because `verifyBootstrap` does not exist.

- [ ] **Step 2: Implement the injected bootstrap workflow**

Create `tests/helpers/bootstrap-project.ts`:

```ts
export type BootstrapMode = 'offline' | 'cold'

export interface BootstrapOptions {
  readonly sourceRoot: string
  readonly tempParent: string
  readonly mode: BootstrapMode
  readonly storeDirectory: string
  readonly relativePaths?: readonly string[]
  readonly run?: typeof runCommand
}

export interface BootstrapEvidence {
  readonly mode: BootstrapMode
  readonly firstBuildHashes: Readonly<Record<string, string>>
  readonly secondBuildHashes: Readonly<Record<string, string>>
  readonly pendingBuilds: readonly string[]
}

export async function verifyBootstrap(options: BootstrapOptions): Promise<BootstrapEvidence>
```

Use `relativePaths` when supplied by a unit test; otherwise call `listProjectFiles(sourceRoot)`. Copy only that manifest to a child directory named `Lattice 质量门禁 <randomUUID()>`. Run frozen install with `--store-dir`; add `--offline` only in offline mode. Run `pnpm ignored-builds`, require an empty parsed package list, run `pnpm build`, hash artifacts, remove `out`, run build again, and require identical maps. Always call `removeWithRetry` in `finally`.

- [ ] **Step 3: Run unit tests to green**

Run: `pnpm test -- tests/unit/helpers/bootstrap-project.spec.ts`

Expected: PASS for offline/cold argument selection, failures, and cleanup.

- [ ] **Step 4: Add offline TC-M0-001 integration**

Create `tests/integration/project-bootstrap.spec.ts`:

```ts
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { pnpmCommand, runCommand } from '../helpers/command'
import { verifyBootstrap } from '../helpers/bootstrap-project'

describe('TC-M0-001 offline bootstrap regression', () => {
  let tempParent: string
  let storeDirectory: string

  beforeAll(async () => {
    tempParent = await mkdtemp(join(tmpdir(), 'Lattice 离线门禁 '))
    const invocation = pnpmCommand(['store', 'path', '--silent'])
    const result = await runCommand(invocation.command, invocation.args, {
      cwd: process.cwd(),
      timeoutMs: 30_000
    })
    if (result.exitCode !== 0) throw new Error(result.stderr)
    storeDirectory = result.stdout.trim()
  })

  afterAll(async () => rm(tempParent, { recursive: true, force: true }))

  it('installs offline and builds identically twice in a Chinese-and-space path', async () => {
    const evidence = await verifyBootstrap({
      sourceRoot: process.cwd(),
      tempParent,
      mode: 'offline',
      storeDirectory
    })
    expect(evidence.firstBuildHashes).toEqual(evidence.secondBuildHashes)
    expect(evidence.pendingBuilds).toEqual([])
  })
})
```

Run: `pnpm test:integration -- tests/integration/project-bootstrap.spec.ts`

Expected: PASS with pnpm offline mode and stable hashes.

- [ ] **Step 5: Add explicit cold TC-M0-008**

Create `tests/bootstrap/project-cold-bootstrap.spec.ts`:

```ts
import { access, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { verifyBootstrap } from '../helpers/bootstrap-project'

describe('TC-M0-008 cold bootstrap', () => {
  let tempParent: string
  let storeDirectory: string

  beforeAll(async () => {
    tempParent = await mkdtemp(join(tmpdir(), 'Lattice 冷自举 '))
    storeDirectory = join(tempParent, '.pnpm-store')
  })

  afterAll(async () => rm(tempParent, { recursive: true, force: true }))

  it('uses an initially empty project store and builds identically twice', async () => {
    await expect(access(storeDirectory)).rejects.toThrow()
    const evidence = await verifyBootstrap({
      sourceRoot: process.cwd(),
      tempParent,
      mode: 'cold',
      storeDirectory
    })

    await expect(access(storeDirectory)).resolves.toBeUndefined()
    expect(evidence.firstBuildHashes).toEqual(evidence.secondBuildHashes)
    expect(evidence.pendingBuilds).toEqual([])
  })
})
```

Run: `pnpm test:bootstrap:cold`

Expected: PASS when network/CDN are available; the output identifies TC-M0-008 and the evidence records that the store started empty.

- [ ] **Step 6: Commit bootstrap automation**

```powershell
git add tests/helpers/bootstrap-project.ts tests/unit/helpers/bootstrap-project.spec.ts tests/integration/project-bootstrap.spec.ts tests/bootstrap/project-cold-bootstrap.spec.ts
git commit -m "test(M0-T02): automate bootstrap acceptance"
```

---

### Task 6: Prove Every Quality Command Fails Correctly Without Recursion

**Files:**

- Create: `tests/integration/quality-scripts.spec.ts`
- Modify: `vitest.integration.config.ts` (retain the exact child-only exclusion while formatting or type corrections are made)

**Interfaces:**

- Consumes: temporary copy and command helpers; `LATTICE_QUALITY_META_CHILD=1`
- Produces: TC-M0-002 evidence for normal commands and six injected faults

- [ ] **Step 1: Write the positive command-contract test**

Create `tests/integration/quality-scripts.spec.ts` with a `runPnpm(root, script)` helper that uses `pnpmCommand`, a 5-minute timeout, and this child environment:

```ts
const childEnvironment = {
  ...process.env,
  LATTICE_QUALITY_META_CHILD: '1'
}
```

In a fresh copied project with an offline frozen install, run these scripts one by one and assert exit 0:

```ts
const executableScripts = [
  'format:check',
  'lint',
  'typecheck',
  'test',
  'test:integration',
  'test:e2e',
  'test:security',
  'test:performance',
  'build',
  'check'
] as const
```

Run: `pnpm test:integration -- tests/integration/quality-scripts.spec.ts`

Expected: the first run may fail only where a real command defect remains; it must not recurse or hang.

- [ ] **Step 2: Add six isolated fault mutators**

Define exact mutators inside the test:

```ts
const faults = [
  {
    name: 'format',
    directScript: 'format:check',
    inject: (root: string) => writeFile(join(root, 'injected-format.json'), '{"bad":true}')
  },
  {
    name: 'lint',
    directScript: 'lint',
    inject: (root: string) => writeFile(join(root, 'tests/injected-lint.ts'), 'debugger\n')
  },
  {
    name: 'type',
    directScript: 'typecheck',
    inject: (root: string) =>
      writeFile(join(root, 'tests/injected-type.ts'), 'export const value: string = 1\n')
  },
  {
    name: 'unit',
    directScript: 'test',
    inject: (root: string) =>
      writeFile(
        join(root, 'tests/unit/injected-failure.spec.ts'),
        "import { expect, it } from 'vitest'\nit('fails', () => expect(true).toBe(false))\n"
      )
  },
  {
    name: 'integration',
    directScript: 'test:integration',
    inject: (root: string) =>
      writeFile(
        join(root, 'tests/integration/injected-failure.spec.ts'),
        "import { expect, it } from 'vitest'\nit('fails', () => expect(true).toBe(false))\n"
      )
  },
  {
    name: 'build',
    directScript: 'build',
    inject: (root: string) => rm(join(root, 'src/main/index.ts'))
  }
] as const
```

For each fault, create a fresh copy, install offline, inject, run the direct script and guarded `check`, require both exit codes to be non-zero, then clean in `finally`.

- [ ] **Step 3: Add anti-cheat assertions**

Read `package.json#scripts` and require each contracted script to exist, be non-empty, and not match `exit 0`, `process.exit(0)`, `echo success`, or a no-op command. Recursively scan owned test sources and fail on `.skip(` or `.only(`. Exclude documentation and third-party/generated directories.

Run: `pnpm test:integration -- tests/integration/quality-scripts.spec.ts`

Expected: PASS; six faults each prove both direct and aggregate failure; execution finishes within configured timeout.

- [ ] **Step 4: Run the full daily gate twice**

Run: `pnpm check`

Expected: exit 0, including the parent TC-M0-002.

Run again: `pnpm check`

Expected: exit 0 again with no dirty tracked files and no retained temporary directories.

- [ ] **Step 5: Commit the meta-test**

```powershell
git add tests/integration/quality-scripts.spec.ts vitest.integration.config.ts
git commit -m "test(M0-T02): enforce quality command failures"
```

---

### Task 7: Record Evidence, Close M0-T02, and Request Review

**Files:**

- Create: `docs/evidence/M0-T02-quality-toolchain-2026-07-18.md`
- Modify: `tasks/state.json`

**Interfaces:**

- Consumes: all M0-T02 commands and test output
- Produces: auditable task evidence, M0-T02 `passed`, M0-T03 `ready`

- [ ] **Step 1: Run final verification from a clean working tree candidate**

Run in order and record timestamps/exit codes:

```powershell
corepack pnpm --version
pnpm install --frozen-lockfile --offline
pnpm ignored-builds
pnpm check
pnpm check
pnpm test:e2e
pnpm test:security
pnpm test:performance
pnpm test:bootstrap:cold
node scripts/verify-planning-docs.mjs
git diff --check
git status --short
```

Expected: pnpm `11.12.0`; all commands exit 0; no ignored builds; only intended M0-T02 files are modified before the final commit.

- [ ] **Step 2: Record evidence without overstating coverage**

Create `docs/evidence/M0-T02-quality-toolchain-2026-07-18.md` with:

```markdown
# M0-T02 Quality Toolchain Evidence

## Environment

- Windows version, Node, Corepack, pnpm, Electron

## Daily gate

- two `pnpm check` executions: timestamps, exit codes, test counts, coverage summaries

## Explicit gates

- E2E, scoped security smoke, performance-harness smoke, TC-M0-008 cold bootstrap

## Fault injection

- format, lint, type, unit, integration, build: direct command exit and guarded `check` exit

## Bootstrap artifacts

- unique lockfile result, pending-build result, first/second SHA-256 maps, cleanup result

## Scope and residual risks

- M0-T03 still owns CSP/navigation/new-window/permission/external-link policies
- M0-T06 still owns CI, SBOM, complete license/transitive dependency audit, and packaged performance gates
- M0-T02 manual verification: not applicable
```

- [ ] **Step 3: Mark completion and unlock only the direct successor**

In `tasks/state.json`:

```json
"current_task": null
```

Set M0-T02 to `passed` with command, test, and report evidence entries pointing to the evidence file. Set only M0-T03 from `blocked` to `ready`; keep M0-T04 and all later tasks unchanged.

- [ ] **Step 4: Validate final documentation and state**

Run: `node scripts/verify-planning-docs.mjs`

Expected: exit 0; M0-T02 passed; only M0-T03 newly ready.

Run: `pnpm check`

Expected: exit 0 after final documentation/state changes.

Run: `git diff --check`

Expected: no output.

- [ ] **Step 5: Request a dedicated code review before the completion commit**

Use `superpowers:requesting-code-review`. Review against the approved design, this plan, AGENTS.md, task contract, TC-M0-001, TC-M0-002, and TC-M0-008. Treat any fake-green, recursion, network-in-check, temp pollution, or Electron privilege leak as blocking.

- [ ] **Step 6: Commit completion evidence and state**

```powershell
git add docs/evidence/M0-T02-quality-toolchain-2026-07-18.md tasks/state.json docs/04-technology-stack.md docs/09-test-strategy.md docs/test-cases/M0-foundation.md
git commit -m "docs(M0-T02): record quality toolchain evidence"
```

- [ ] **Step 7: Verify repository handoff state**

Run: `git status --short`

Expected: no output.

Run: `git log --oneline -8`

Expected: focused M0-T02 commits in task order, with M0-T01 baseline unchanged.

Report changed files, every command and result, residual M0-T03/M0-T06 risks, and that M0-T02 has no manual verification step. Do not push or open a PR unless the user explicitly asks.
