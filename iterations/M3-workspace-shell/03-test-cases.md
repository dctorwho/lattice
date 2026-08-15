# M3 test cases

## Iteration context

- Iteration: `M3`
- State authority: `iterations/state.json`
- Governing test policy: [test strategy](../../docs/09-test-strategy.md)
- Governing safety policy: [data-safety and security](../../docs/05-data-safety-and-security.md)

## Coverage and ownership

Test IDs are stable verification identifiers, not planning units. `覆盖能力` names the capability covered by each case.

## Automated test cases

| ID        | 覆盖能力                            | 层级/级别                 | 数据/环境    | 步骤                                                                                                 | 预期                                                                                              | 自动化                                                                                                                                           |
| --------- | ----------------------------------- | ------------------------- | ------------ | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| TC-M3-001 | Full command/menu shell             | component-e2e/P1          | CMD-M3       | Invoke commands from menu, toolbar, context, shortcut in varied session/selection/workspace state    | Same ID; visible/enabled/checked synced; no unimplemented command; diagnostic conflicts           | `pnpm test:e2e -- tests/e2e/window-commands.spec.ts`；证据：E2E command trace；停止条件：Divergent command behavior                              |
| TC-M3-002 | Authorized workspace enumeration    | integration-security/P0   | WSROOT-M3    | Select root, enumerate extensions/hidden/ignore/symlink; forge external path; cancel                 | Authorized-root files only; consistent policy; no symlink escape; cancel leaves editor usable     | `pnpm test:integration -- tests/integration/workspace-enumeration.spec.ts`；证据：Root/snapshot trace；停止条件：Path escape or blocked editor   |
| TC-M3-003 | Tree/list and file operations       | e2e/P0                    | FILEOP-M3    | Switch/sort/expand/select; create/rename/move/recycle delete/reveal; inject permission/lock failures | Views agree; natural sort; dangerous confirmation; recoverable failure; active source retained    | `pnpm test:e2e -- tests/e2e/workspace-file-ops.spec.ts`；证据：E2E/filesystem evidence；停止条件：Destructive loss or false success              |
| TC-M3-004 | Incremental outline                 | component-performance/P1  | OUTLINE-M3   | Hierarchy/flat/fold/filter/follow/click; edit heading                                                | Stable duplicates/skips; correct location; no extra full parse; long input unblocked              | `pnpm test -- tests/unit/component/outline.spec.ts`；证据：Performance trace；停止条件：Blocked input or bad anchor                              |
| TC-M3-005 | Quick open                          | component-performance/P1  | OPEN-M3      | Search 10,000 filenames/relative paths, keyboard choose/cancel/sort/recents                          | Consistent CJK/case/separator rules; root-only; first result budgeted; cancel unchanged           | `pnpm test -- tests/unit/component/quick-open.spec.ts`；证据：Performance and result trace；停止条件：Outside-root result                        |
| TC-M3-006 | Global search                       | integration-security/P0   | SEARCH-M3    | Search normal/Unicode/metacharacters; ignore/binary/large results; merge dirty docs; cancel process  | Argument array and `shell:false`; correct deduped ranges; limits apply; cancellation ends sidecar | `pnpm test:integration -- tests/integration/global-search.spec.ts`；证据：Args, exit, result evidence；停止条件：Injection or child-process leak |
| TC-M3-007 | Recent projects and window sessions | e2e/P1                    | SESSION-M3   | Multiwindow recents, resize/display/sidebar/file/scroll, crash/restart after display disconnect      | Visible bounds; per-window state; missing path removable; session has no text                     | `pnpm test:e2e -- tests/e2e/window-session.spec.ts`；证据：Session audit；停止条件：Off-screen or text leakage                                   |
| TC-M3-008 | Workspace gate                      | performance-regression/P0 | GATE-M3      | Edit, enumerate, quick-open, search/cancel in 10,000-file root; full regression                      | Input P95 budgeted; work cancellable; error matrix passes; no root escape/P0/P1                   | `pnpm test:performance -- tests/performance/m3-gate.spec.ts`；证据：P50/P95 and report；停止条件：P0/P1 or blocked input                         |
| TC-M3-009 | File-operation fault consistency    | integration/P0            | FILEFAULT-M3 | Inject failures through preflight, execution, watcher update, UI commit for rename/move/trash        | Disk/tree/recents/session converge; no false success; actionable error                            | `pnpm test:integration -- tests/integration/file-operation-faults.spec.ts`；证据：Fault traces；停止条件：Inconsistent state                     |

## Manual test cases

| ID         | 覆盖能力                             | 环境                                               | 步骤                                                                                                                                   | 通过条件                                                                                                   | 证据                                                                                                                                                                             |
| ---------- | ------------------------------------ | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MAN-M3-001 | Practical large-workspace acceptance | Real large repository, ENV-SYNC, multiple displays | Open 10,000+ files while typing; create sync events; create/rename/move/recycle; cancel large search; restart after display disconnect | No perceptible input stall; no path escape/misoperation; recycle delete; searchable cancel; visible window | Repository scale, performance record, Explorer/Task Manager captures, sanitized session audit；停止条件：Any loss, escape, lingering process, blocked input, or invisible window |

## Parameter matrix

| Parameter ID | Variables                                                                                                                                                    | Fixture                                                   | Required cases       | Expected result                                                                                      |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------- |
| CMD-M3       | No document; clean, dirty, and read-only; without/with selection; without/with workspace; search running; dialog open; all four command entry paths          | Command context matrix                                    | TC-M3-001            | All entry paths share one ID and derived visible/enabled/checked state                               |
| WSROOT-M3    | Normal, Chinese, spaces, long path, and UNC roots; hidden files, `.gitignore`, custom ignores, case collisions, junction/symlink loops and escapes           | Seeded authorized workspace generator                     | TC-M3-002            | Enumeration is consistent, cancelable, and contained within the authorized root                      |
| FILEOP-M3    | Normal, Unicode, reserved name, case-only rename, long path; target exists, read-only, permission denied, file occupied, cross-volume, and user cancellation | Preflight/execution/watcher/UI fault-injection filesystem | TC-M3-003, TC-M3-009 | Disk, tree, recents, and active session converge without false success or data loss                  |
| OUTLINE-M3   | ATX/Setext, duplicate headings, h1→h4 jump, fake headings in code, HTML, 10 MB document, and selection anchors before/after edits                            | Large outline corpus with expected syntax-tree ranges     | TC-M3-004            | Incremental outline hierarchy and navigation remain accurate and nonblocking                         |
| OPEN-M3      | Chinese Pinyin matching not required, case, path separators, contiguous/fuzzy matching, same-score ordering, and missing recent items                        | Seeded 10,000-path index                                  | TC-M3-005            | Deterministic root-contained ordering and cancellation without session change                        |
| SEARCH-M3    | Chinese, metacharacters with regex off, quotes/semicolon/`&`, large results, binary, ignored, no-permission, and dirty-document/disk same-path results       | Controlled ripgrep sidecar and dirty-session overlay      | TC-M3-006            | Shell-safe bounded results, correct deduplication, actionable errors, and terminated cancellation    |
| SESSION-M3   | Single/dual display, disconnected display, negative coordinates, different DPI, maximized state, corrupt session, and missing recent path                    | Display-layout and versioned-session fixtures             | TC-M3-007            | Restored windows are visible, per-window state is sanitized, and corrupt/missing entries fail safely |

## Fixtures

| Fixture               | Source and integrity                                    | Covered behavior            | Required environment  |
| --------------------- | ------------------------------------------------------- | --------------------------- | --------------------- |
| Workspace generator   | Seeded 10,000-file tree, ignores, Unicode, symlinks     | Enumeration and performance | Windows filesystem    |
| File-fault corpus     | Permissions, locks, existing targets, cancellation      | Recoverable mutation        | Main-process adapters |
| Search/session corpus | Controlled sidecar, binary/large files, display layouts | Search and restoration      | Packaged Electron     |

## Evidence requirements

Record commands, environments, exit codes, generator seeds, tree snapshots,
sidecar arguments/status, before/after directory listings, session audit, and
P50/P95. Manual evidence records the operator, hardware/displays, and result.

## Stop conditions

Unauthorized access, permanent erroneous deletion, uncancelled child process,
10,000-file work blocking input, session source-text leakage, or invisible
restored windows stops iteration progress.
