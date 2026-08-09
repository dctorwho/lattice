# M4 test cases

## Iteration context

- Iteration: `M4`
- State authority: `iterations/state.json`
- Governing test policy: [test strategy](../../docs/09-test-strategy.md)
- Governing safety policy: [data-safety and security](../../docs/05-data-safety-and-security.md)

## Coverage and ownership

Test IDs are stable verification identifiers, not planning units. `覆盖能力` names the capability covered by each case.

## Automated test cases

| ID        | 覆盖能力                                    | 层级/级别                           | 数据/环境   | 步骤                                                                                                  | 预期                                                                                                             | 自动化                                                                                                                                       |
| --------- | ------------------------------------------- | ----------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| TC-M4-001 | Advanced feature registration and fallback  | unit/P0                             | ADAPTER-M4  | Toggle features; inject parse/render/apply timeout, exception, invalid range, stale revision          | Parser/renderer flags agree; off preserves source; failure source fallback; session/history intact               | `pnpm test -- tests/unit/markdown/block-adapter-contract.spec.ts`；证据：Source/range/revision trace；停止条件：Drift or stale overwrite     |
| TC-M4-002 | YAML, TOC, and Alerts                       | component/P1                        | META-M4     | Edit valid/bad/multiline/duplicate YAML; update headings/TOC; edit nested alerts; toggle flags        | Unrelated edit does not reformat YAML; incremental TOC; correct alert ranges; bad input source-editable          | `pnpm test -- tests/unit/component/yaml-toc-alerts.spec.ts`；证据：Component hashes；停止条件：Reformat or crash                             |
| TC-M4-003 | Advanced code blocks                        | component-performance/P1            | CODEADV-M4  | Change languages/aliases; indent/Shift+Tab/copy; edit final line, fence collision, unknown/long code  | On-demand grammar; unknown fallback; exact copy; fences retained; performance budget                             | `pnpm test -- tests/unit/component/advanced-code.spec.ts`；证据：Load/scroll trace；停止条件：Blocked input or source loss                   |
| TC-M4-004 | Table projection                            | unit-component/P0                   | TABLE-M4    | Enter/leave valid/wide/missing-cell/escaped-pipe/inline/incomplete tables                             | Cell/range/delimiter match source; inactive projects; active source-editable; display no write                   | `pnpm test -- tests/unit/component/table-projection.spec.ts`；证据：Ranges and hashes；停止条件：Source mutation                             |
| TC-M4-005 | Table operations                            | property-e2e/P0                     | TABLEOP-M4  | Random add/delete/move row/column, alignment, Tab navigation, selection, stale revision, undo         | Target-table patch only; untouched layout stable; conflict rejects; reversible selection-aware operations        | `pnpm test -- tests/unit/property/table-operations.spec.ts`；证据：Seeds, diffs, undo trace；停止条件：Broad patch or nonreversible edit     |
| TC-M4-006 | Footnotes, references, anchors, local links | component/P1                        | ACADEMIC-M4 | Jump/hover footnotes, references, anchors, local links; edit duplicates/missing definitions           | Diagnostics for missing; stable duplicate rules/CJK anchors; no auto relocation; decoded paths                   | `pnpm test -- tests/unit/component/academic-links.spec.ts`；证据：Component trace；停止条件：Wrong link or source relocation                 |
| TC-M4-007 | MathJax safety and performance              | component-security-performance/P0   | MATH-M4     | Render four delimiters/macros/numbers/bad TeX; copy TeX/MathML; hostile/large input; viewport scroll  | Offline render; source diagnostics; time/node/output budgets; nonviewport lazy; no script                        | `pnpm test:security -- tests/security/mathjax.spec.ts`；证据：Security/performance evidence；停止条件：Script, network, or resource escape   |
| TC-M4-008 | Mermaid safety and compatibility            | integration-security-performance/P0 | DIAGRAM-M4  | Render supported and legacy diagrams; bad/XSS/large diagram; theme switch/cancel                      | Strict isolation; source on error; links/HTML do not escape; cancel ends work; consistent theme/export model     | `pnpm test:security -- tests/security/mermaid.spec.ts`；证据：Isolation/cancel evidence；停止条件：XSS, host escape, or unbounded work       |
| TC-M4-009 | HTML, video, and embed safety               | security-e2e/P0                     | HTML-M4     | Preview inline/block HTML/video/local assets and XSS/SVG/style/url/iframe/form/remote payloads        | Allowed semantics visible; unsafe sanitized/placeholder; no Node/preload/network/path escape; original unchanged | `pnpm test:security -- tests/security/html-preview.spec.ts`；证据：Security trace and source hash；停止条件：Active content or source change |
| TC-M4-010 | Advanced Markdown gate                      | regression-performance/P0           | GATE-M4     | Advanced golden corpus, security payloads, 10,000 random table patches, large math/diagram benchmarks | COMP-014..020 evidence; all complex blocks fallback; no drift/escape/resource loss                               | `pnpm test:performance -- tests/performance/m4-gate.spec.ts`；证据：Gate report；停止条件：Any P0/P1 or contract breach                      |

## Manual test cases

| ID         | 覆盖能力                          | 环境                | 步骤                                                                                                                                  | 通过条件                                                                                                  | 证据                                                                                                                                                        |
| ---------- | --------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MAN-M4-001 | Advanced block offline acceptance | Windows 11, offline | Bulk table row/column operations and undo; complex formulas/macros; multiple Mermaid; bad YAML/HTML; repeated source/hybrid switching | Editable with source fallback; no undo drift; offline; bad input cannot crash/execute; security UI intact | Source diff, recording, offline proof, performance/security report, signed conclusion；停止条件：Drift, executable hostile content, or unavailable fallback |

## Parameter matrix

| Parameter ID | Variables                                                                                                                                                                         | Fixture                                                   | Required cases       | Expected result                                                                                                |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------- |
| ADAPTER-M4   | YAML, TOC, Alerts, code, table, footnote, math, diagram, and HTML; feature on/off; throw, timeout, invalid patch, and old revision                                                | Feature-by-feature adapter snapshots                      | TC-M4-001            | Every adapter follows the same bounded lifecycle and source-fallback contract                                  |
| META-M4      | Empty/valid/unclosed YAML, multiline/comment/duplicate key/custom order; TOC heading add/delete/change; NOTE, TIP, IMPORTANT, WARNING, CAUTION, and nested quote                  | Metadata, TOC, and alert corpus with exact ranges         | TC-M4-002            | Unrelated source formatting is retained and malformed metadata remains editable                                |
| TABLE-M4     | Escaped `\|`, pipe inside code, inline emphasis, 0/1/100 columns, missing/extra cell, left/center/right alignment, Chinese width, and no final newline                            | Table parse/projection corpus with source ranges          | TC-M4-004            | Cell/range/delimiter mappings are exact and display does not change source                                     |
| TABLEOP-M4   | First/middle/last row and column, empty/rich-text cell, add/delete/move/alignment, Tab/Shift+Tab, 100 seeds and 10,000 gate sequences                                             | Seeded table-operation property corpus                    | TC-M4-005, TC-M4-010 | Operations patch only the target table, reject conflicts, and undo completely                                  |
| ACADEMIC-M4  | Duplicate/missing/cyclic footnote references, Chinese/Emoji headings, same-name anchors, paths with spaces/`#`/`%`, and outside-workspace targets                                 | Academic-link corpus and authorized workspace             | TC-M4-006            | Stable diagnostics/anchors and no unauthorized target or source relocation                                     |
| MATH-M4      | `$`, `$$`, `\(...\)`, `\[...\]`; macros, numbering, references, syntax errors, HTML-like TeX, 10/100/1,000 formulas, and oversized expression                                     | Offline MathJax security/performance corpus               | TC-M4-007            | Correct offline rendering/fallback with timeout, node, and output budgets                                      |
| DIAGRAM-M4   | flowchart, sequence, class, state, ER, gantt, pie, mindmap, timeline, gitGraph, and other supported diagram types; legacy entry; malicious links/HTML; deep graph/oversized nodes | Strict-isolation Mermaid corpus                           | TC-M4-008            | Supported diagrams render; hostile/oversized work is isolated, bounded, and cancelable                         |
| HTML-M4      | Safe text/table/video and local resources; script, event, style, URL, SVG, iframe, form, object, meta, base; encoding and case confusion                                          | Sanitization, CSP, network, and path-authorization corpus | TC-M4-009            | Allowed semantics remain visible while executable/network/path-escaping content is blocked and source retained |

## Fixtures

| Fixture                      | Source and integrity                                 | Covered behavior                     | Required environment |
| ---------------------------- | ---------------------------------------------------- | ------------------------------------ | -------------------- |
| Advanced Markdown corpus     | YAML, TOC, alerts, code, tables, academic links      | Adapter semantics                    | CodeMirror/Electron  |
| Math/diagram security corpus | TeX budgets, supported graphs, XSS/large graphs      | Isolated rendering                   | Offline sandbox      |
| HTML security corpus         | SVG/style/URL/frame/form/media and local-path probes | Sanitization and source preservation | Isolated renderer    |

## Evidence requirements

Record commands, environment, exit code, parameters, source/range/revision/
patch/undo traces, random seeds, CSP/network/process evidence, and reports.
Manual evidence records operator, offline environment, recordings, source diffs,
and evaluator conclusion.

## Stop conditions

Unrelated source reformatting, stale-patch overwrite, hostile-content execution
or host/network escape, non-terminating resource work, missing source fallback,
or any P0/P1 failure stops iteration progress.
