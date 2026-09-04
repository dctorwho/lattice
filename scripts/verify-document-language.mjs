import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const markdownRoots = ['docs', 'iterations']
const rootDocuments = ['AGENTS.md', 'README.md', 'build/brand/README.md']
const excludedDirectoryNames = new Set(['.git', '.superpowers', 'dist', 'node_modules', 'out'])
const cjkPattern = /[\u3400-\u9fff]/u
const englishWordPattern = /[A-Za-z]+(?:[-'][A-Za-z]+)*/g

const legacyHeadings = new Set([
  'Iteration context',
  'Objectives',
  'User-observable outcomes',
  'Scope',
  'Non-goals',
  'Requirement and compatibility coverage',
  'Preconditions and external dependencies',
  'Risks and mitigations',
  'Iteration-level acceptance criteria',
  'Entry completeness',
  'Architecture boundaries',
  'Capability design',
  'Module responsibilities',
  'Interfaces and data flow',
  'Data safety, failure handling, migration, and compatibility constraints',
  'Dependency admission',
  'Manual-gate design',
  'Implementation order',
  'Coverage and ownership',
  'Automated test cases',
  'Manual test cases',
  'Parameter matrix',
  'Fixtures',
  'Evidence requirements',
  'Stop conditions',
  'Report status',
  'Baseline and environment',
  'Existing validation',
  'Executed commands and results',
  'Automated case results',
  'Manual case results',
  'Failures, fixes, and regression evidence',
  'Unexecuted verification',
  'Residual risks',
  'Manual-gate handoff',
  'Exit-readiness statement',
  'Requirement completion matrix',
  'Final deliverables',
  'Material implementation and documentation changes',
  'Automated-gate conclusion',
  'Manual-gate conclusion',
  'Known limitations and residual risks',
  'Rollback approach',
  'Inputs released to the next iteration',
  'Final iteration decision'
])

const legacyTableHeaders = new Set([
  'Case ID | Result | Evidence | Notes',
  'Case ID | Result | Evaluator | Evidence',
  'Global ID | Required outcome | Completion evidence | Result'
])

const toPosix = (value) => value.split(path.sep).join('/')

const walkMarkdown = (root, directory, files) => {
  if (!fs.existsSync(directory)) return
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (excludedDirectoryNames.has(entry.name)) continue
    const absolute = path.join(directory, entry.name)
    const relative = toPosix(path.relative(root, absolute))
    if (relative === 'docs/archive' || relative.startsWith('docs/archive/')) continue
    if (entry.isDirectory()) {
      walkMarkdown(root, absolute, files)
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      files.add(relative)
    }
  }
}

export const collectActiveDocumentationFiles = (root) => {
  const files = new Set()
  for (const relativePath of rootDocuments) {
    if (fs.statSync(path.join(root, relativePath), { throwIfNoEntry: false })?.isFile()) {
      files.add(relativePath)
    }
  }
  for (const directory of markdownRoots) {
    walkMarkdown(root, path.join(root, directory), files)
  }
  return [...files].sort()
}

const stripProtectedInlineText = (line) =>
  line
    .replace(/`[^`]*`/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\]\([^)]*\)/g, ']')
    .replace(/<!--.*?-->/g, '')
    .trim()

const normalizedTableHeader = (line) =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())
    .join(' | ')

export const findChineseDocumentationViolations = (relativePath, content) => {
  const violations = []
  let fenceMarker = null
  const lines = content.split(/\r?\n/)

  for (const [index, originalLine] of lines.entries()) {
    const trimmed = originalLine.trim()
    const fenceMatch = /^(?<marker>`{3,}|~{3,})/.exec(trimmed)
    if (fenceMatch?.groups?.marker !== undefined) {
      const marker = fenceMatch.groups.marker[0]
      if (fenceMarker === null) fenceMarker = marker
      else if (marker === fenceMarker) fenceMarker = null
      continue
    }
    if (fenceMarker !== null || trimmed.length === 0 || /^\s*\|?\s*:?-{3,}/.test(trimmed)) {
      continue
    }

    const line = stripProtectedInlineText(originalLine)
    if (line.length === 0 || cjkPattern.test(line)) continue

    const headingMatch = /^#{1,6}\s+(.+?)\s*$/.exec(line)
    if (headingMatch !== null) {
      const heading = headingMatch[1]
      const wordCount = heading.match(englishWordPattern)?.length ?? 0
      if (legacyHeadings.has(heading) || wordCount >= 2) {
        violations.push({
          relativePath,
          line: index + 1,
          reason: '标题必须使用中文',
          text: trimmed
        })
      }
      continue
    }

    if (trimmed.startsWith('|')) {
      if (legacyTableHeaders.has(normalizedTableHeader(trimmed))) {
        violations.push({
          relativePath,
          line: index + 1,
          reason: '表头必须使用中文',
          text: trimmed
        })
      }
      continue
    }

    if (/^Decision:\s*(?:passed|failed)\s*$/.test(line)) {
      violations.push({
        relativePath,
        line: index + 1,
        reason: '迭代结论行必须使用中文',
        text: trimmed
      })
      continue
    }

    const wordCount = line.match(englishWordPattern)?.length ?? 0
    if (wordCount >= 6) {
      violations.push({
        relativePath,
        line: index + 1,
        reason: '叙述内容必须使用中文',
        text: trimmed
      })
    }
  }

  return violations
}

export const verifyActiveDocumentationLanguage = (root) => {
  const violations = []
  for (const relativePath of collectActiveDocumentationFiles(root)) {
    const content = fs.readFileSync(path.join(root, relativePath), 'utf8')
    violations.push(...findChineseDocumentationViolations(relativePath, content))
  }
  return violations
}

const isMain =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMain) {
  const violations = verifyActiveDocumentationLanguage(process.cwd())
  if (violations.length > 0) {
    for (const violation of violations) {
      console.error(
        `${violation.relativePath}:${violation.line}: ${violation.reason}：${violation.text}`
      )
    }
    console.error(`活跃资料中文门禁失败：共发现 ${violations.length} 处问题。`)
    process.exitCode = 1
  } else {
    console.log(
      `活跃资料中文门禁通过：已检查 ${collectActiveDocumentationFiles(process.cwd()).length} 个文件。`
    )
  }
}
