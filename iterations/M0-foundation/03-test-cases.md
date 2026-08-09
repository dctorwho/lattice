# M0 test cases

## Iteration context

- Iteration: `M0`
- State authority: `iterations/state.json`
- Governing test policy: [test strategy](../../docs/09-test-strategy.md)
- Governing safety policy:
  [data-safety and security](../../docs/05-data-safety-and-security.md)

## Coverage and ownership

Test IDs are stable verification identifiers. They are not subtask IDs and do
not own planning state, dependencies, implementation work, manual gates, or
reports. The `覆盖能力` column names the capability covered by the case.

## Automated test cases

| ID        | 覆盖能力                                         | 层级/级别        | 数据/环境                                                    | 步骤                                                                                                                                                                          | 预期                                                                                                                                                     | 自动化                                                                                                                                                                                      |
| --------- | ------------------------------------------------ | ---------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TC-M0-001 | Reproducible offline bootstrap                   | integration/P1   | ENV-M0-A with validated store and offline install            | Frozen offline install and two builds in a Chinese-and-space path                                                                                                             | Unique lockfile, no pending builds, stable artifact hashes, cleanup                                                                                      | `pnpm test:integration -- tests/integration/project-bootstrap.spec.ts`；证据：Exit codes and artifact hashes；停止条件：Any non-reproducible build or cleanup failure                       |
| TC-M0-002 | Quality command fault handling                   | integration/P1   | Isolated temporary copies                                    | Run normal scripts; inject format, lint, type, unit, integration, and build faults                                                                                            | Direct commands and guarded nested `check` fail correctly without recursion                                                                              | `pnpm test:integration -- tests/integration/quality-scripts.spec.ts`；证据：Fault matrix and exit codes；停止条件：Any falsely successful or recursive check                                |
| TC-M0-008 | Cold bootstrap                                   | integration/P1   | Chinese-and-space path, empty project store, network allowed | Frozen install and two builds                                                                                                                                                 | Unique lockfile, no pending builds, stable artifacts, cleanup                                                                                            | `pnpm test:bootstrap:cold`；证据：Command output and hashes；停止条件：Any install, build, or cleanup failure                                                                               |
| TC-M0-003 | Production Electron privilege boundary           | security/P0      | SEC-M0-A                                                     | Launch production configuration; probe main, forged, destroyed windows, Node/Electron/raw IPC, polluted objects, and oversized renderer messages                              | `require`, `process`, `ipcRenderer`, `fs`, and `shell` unavailable; sandbox/window policy effective; window survives                                     | `pnpm test:security -- tests/security/electron-boundary.spec.ts`；证据：Production Electron security evidence；停止条件：Any renderer privilege exposure or policy bypass                   |
| TC-M0-004 | Navigation, permission, and external-link policy | e2e-security/P0  | SEC-M0-B                                                     | Trigger http/file/javascript/data/custom protocols, navigation, new windows, and permission requests                                                                          | Only confirmed https/mailto external links go to the OS; all others denied; no main-window navigation or DevTools backdoor                               | `pnpm test:e2e -- tests/e2e/navigation-policy.spec.ts`；证据：Policy, confirmation-double, and runtime evidence；停止条件：Unsafe protocol execution, navigation, or permission grant       |
| TC-M0-005 | Validated IPC contracts and frozen preload API   | unit-security/P1 | CONTRACT-M0                                                  | Cover strict Zod requests/responses, budgets, six sender denials, fixed routing, unserializable results, redacted logs, preload validation, and real Electron `app.getInfo()` | Stable request-correlated `Result`; unknown channel unavailable; application contract compatible                                                         | `pnpm test -- tests/unit/shared/contracts.spec.ts`；证据：Unit, preload, and production Electron evidence；停止条件：Sender/schema/serialization breach or raw privilege exposure           |
| TC-M0-006 | Unified command registry and window shell        | component-e2e/P1 | COMMAND-M0                                                   | Invoke one registry from native menu, button, renderer context menu, and shortcut; vary visible/enabled/checked context; inspect About, focus restoration, and preload        | Four inputs share command ID/state; disabled command does not execute; focus restores deterministically; frozen `{ app, commands }`; invalid event drops | `pnpm test -- tests/unit/component/command-registry.spec.tsx`；证据：Registry, menu, component, and Electron evidence；停止条件：Divergent command behavior, focus loss, or boundary breach |
| TC-M0-007 | CI, dependency audit, SBOM, and packaging gate   | integration/P1   | ENV-M0-A                                                     | From clean checkout run CI-equivalent commands, license audit, SBOM, and artifact checks                                                                                      | Commands match documentation; artifact launches; dependencies have versions/licenses; SBOM parses and covers production dependencies                     | `pnpm test:integration -- tests/integration/m0-gate.spec.ts`；证据：CI output, audit report, SBOM, and artifact hashes；停止条件：Missing audit/SBOM evidence or unlaunchable package       |

## Manual test cases

| ID         | 覆盖能力                            | 环境                     | 步骤                                                                                                                                        | 通过条件                                                                                                               | 证据                                                                                                                            |
| ---------- | ----------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| MAN-M0-001 | Packaged-shell and audit acceptance | Windows 11 standard user | Inspect packaged window and process arguments; attempt DevTools/navigation; review preload API, CI, licenses, and SBOM; rerun release build | No Node/raw IPC/development URL; application launches; dependency provenance/licenses acceptable; CI evidence complete | Screenshots, build hashes, audit report, signed conclusion；停止条件：Any privilege exposure, rejected audit, or launch failure |

## Parameter matrix

| Parameter ID | Variables                                                                                                          | Fixture                              | Required cases       | Expected result                                              |
| ------------ | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------ | -------------------- | ------------------------------------------------------------ |
| ENV-M0-A     | Chinese-and-space standard-user path; validated pnpm store; daily-regression frozen offline install repeated twice | Isolated checkout                    | TC-M0-001, TC-M0-007 | Reproducible, idempotent offline installs/builds and cleanup |
| ENV-M0-B     | Chinese-and-space path; empty project store; network-enabled frozen install                                        | Cold bootstrap checkout              | TC-M0-008            | Reproducible cold bootstrap                                  |
| SEC-M0-A     | Main/forged/destroyed windows; valid/missing/invalid request IDs; prototype pollution; oversized payload           | Production Electron security harness | TC-M0-003            | No renderer privilege or policy escape                       |
| SEC-M0-B     | https, mailto, http, file, javascript, data, mixed-case/encoded protocols, redirects                               | Navigation policy harness            | TC-M0-004            | Only confirmed approved targets reach OS handoff             |
| CONTRACT-M0  | Success, business, validation, permission, cancellation, timeout; no text/absolute paths in error details          | Contract fixtures                    | TC-M0-005            | Stable bounded and redacted results                          |
| COMMAND-M0   | No session, clean/dirty session, no editor, dialog open, window unfocused                                          | Command shell fixtures               | TC-M0-006            | Validated unified command behavior                           |

## Fixtures

| Fixture     | Source and integrity                                        | Covered behavior                               | Required environment             |
| ----------- | ----------------------------------------------------------- | ---------------------------------------------- | -------------------------------- |
| ENV-M0-A/B  | Isolated paths and preserved lockfile/artifact hashes       | Bootstrap and package reproducibility          | Windows build environment        |
| SEC-M0-A/B  | Production Electron policy probes and controlled OS doubles | Privilege, navigation, and external URL policy | No development URL               |
| CONTRACT-M0 | Strict Zod payload, sender, value-budget, and log fixtures  | IPC contract fail-closed behavior              | Unit and production Electron     |
| COMMAND-M0  | Session/editor/dialog/focus-state matrix                    | Registry and native-menu projection            | Renderer and production Electron |

## Evidence requirements

Record command, environment, exit code, parameter selection, result, and
artifact or report reference for each automated case. Preserve script exit
codes, build hashes, preload-surface snapshots, CSP/security configuration,
SBOM, and license reports. Record evaluator, date, environment, steps, and
signed conclusion for the manual case.

## Stop conditions

Renderer access to Node or raw IPC, dangerous protocol execution, a falsely
green quality command, unreproducible builds, missing audit evidence, or a
package launch failure stops iteration progress until fixed and regressed.
