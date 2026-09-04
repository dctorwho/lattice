export interface DocumentationLanguageViolation {
  readonly relativePath: string
  readonly line: number
  readonly reason: string
  readonly text: string
}

export function collectActiveDocumentationFiles(root: string): string[]

export function findChineseDocumentationViolations(
  relativePath: string,
  content: string
): DocumentationLanguageViolation[]

export function verifyActiveDocumentationLanguage(root: string): DocumentationLanguageViolation[]
