# M7 requirements

## Iteration context

- Iteration: `M7`
- State authority: `iterations/state.json`
- Global rules: [product charter](../../docs/00-product-charter.md), [architecture](../../docs/03-architecture.md), [data-safety and security](../../docs/05-data-safety-and-security.md), and [test strategy](../../docs/09-test-strategy.md)

## Objectives

Harden the product for release-candidate readiness through real settings, configurable
shortcuts, bilingual accessibility, complete compatibility traceability, performance and
large-document validation, privacy-safe diagnostics, and extended real-world use.

## User-observable outcomes

- Every setting and shortcut works predictably, survives supported migrations, and explains
  conflicts or restart behavior.
- Simplified Chinese and English UI paths are accessible by keyboard and screen reader across
  supported scales and high-contrast modes.
- Users can work with large documents and workspaces within recorded budgets; diagnostics do
  not expose their content or private paths.

## Scope

- UI-005..008 settings, shortcuts, localization, and accessibility; DOC-010 large-file mode;
  NFR-001..006 and NFR-009..010 reliability, response, scale, privacy, and Windows support.
- Evidence for every COMP-001..036 item, including documented gaps with provenance and a
  user-approved release-candidate audit.

## Non-goals

- Adding unplanned product features, treating a category smoke test as compatibility proof,
  or claiming manual daily-use/RC approval without an evaluator.
- Relaxing data/security invariants to meet performance targets or logging document data for
  diagnosis.

## Requirement and compatibility coverage

| Global ID     | Iteration outcome                                                                                    | Acceptance evidence                             |
| ------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| UI-005..008   | Versioned settings, shortcuts, localization, and accessible controls work end-to-end.                | Settings, accessibility, and evaluator evidence |
| DOC-010       | Large files enter a safe source-priority degradation mode.                                           | Packaged performance and soak evidence          |
| NFR-001..006  | Data safety, responsiveness, startup, large-document/workspace, and memory budgets are demonstrated. | Compatibility, benchmark, and soak evidence     |
| NFR-009..010  | Logs are private and Windows scale/IME environments are covered.                                     | Privacy scan and manual-environment evidence    |
| COMP-001..036 | Each compatibility item is passed or has sourced, reproducible, approved documented-gap evidence.    | Traceability, audit, and evaluator evidence     |

## Preconditions and external dependencies

- M6 is `passed` in `iterations/state.json`.
- All earlier capability fixtures, commands, settings consumers, and packaged build harnesses
  are available for traceability and performance measurement.
- A reference Windows environment, screen reader, accessibility tooling, and evaluator-owned
  four-week daily-use/RC evidence process are available.

## Risks and mitigations

- Broad compatibility claims can hide gaps: require one evidence path per COMP ID and retain
  sourced documented gaps.
- Large-file work can harm editing: favor source-first degradation, worker isolation, budgets,
  and P50/P95 data.
- Settings migration or diagnostics can lose/leak user data: use versioned Zod validation,
  atomic backups, canary scans, and redaction.
- Accessibility/localization can regress at scale: test keyboard/Narrator and all required
  scaling modes rather than relying on screenshots alone.

## Iteration-level acceptance criteria

1. All mapped requirements and every COMP item have traceable automated or approved
   documented-gap evidence, with no category-level substitution.
2. Packaged performance results meet the stated NFR budgets and do not regress reference
   baselines by more than the documented threshold.
3. Logs and diagnostics contain no document text, absolute paths, search terms, clipboard,
   YAML values, or export custom content.
4. State-defined automated completion includes the four-week and RC manual evidence required
   by the inherited cases before release-candidate conclusions are used.

## Entry completeness

This document, the detailed design, and the test cases are the three entry documents. All
three must be complete and predecessor iterations must be `passed` before `M7` may become
`ready` or `in_progress`.

No subtask, task-level status, or task-level ownership belongs in this document.
