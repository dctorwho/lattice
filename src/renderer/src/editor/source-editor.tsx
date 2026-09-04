import { useLayoutEffect, useRef, type JSX } from 'react'

import type { CodeMirrorDocumentController } from './code-mirror-document-controller'

export interface SourceEditorProps {
  readonly controller: CodeMirrorDocumentController
}

export function SourceEditor({ controller }: SourceEditorProps): JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const host = hostRef.current
    if (host === null) return
    return controller.attach(host)
  }, [controller])

  return <div ref={hostRef} className="source-editor" aria-label="Markdown 源码编辑器" />
}
