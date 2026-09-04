import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type JSX
} from 'react'

import {
  createDocumentSession,
  createSourceBufferFromText,
  createUntitledDocumentSession,
  restoreDocumentSession,
  type DocumentSession
} from '../../domain/documents'
import type {
  FileSaveOutcome,
  OpenedFile,
  RecoveryRecord,
  RecoverySnapshot,
  ReloadedExternalFile
} from '../../shared/contracts'
import {
  useCommandController,
  type DocumentCommandBindings
} from './commands/use-command-controller'
import { AppShell } from './components/app-shell'
import { UnsavedChangesDialog } from './components/unsaved-changes-dialog'
import { RecoveryDialog } from './components/recovery-dialog'
import { ExternalConflictDialog } from './components/external-conflict-dialog'
import { CodeMirrorDocumentController } from './editor/code-mirror-document-controller'
import { FindReplacePanel } from './editor/find-replace-panel'
import type { Locale } from './i18n/messages'
import { translate } from './i18n/translate'

type DocumentTransition = 'new' | 'open' | 'close' | 'window-close'
type FileConflict = Extract<FileSaveOutcome, { readonly status: 'conflict' }>

export interface AppProps {
  readonly initialEditorController?: CodeMirrorDocumentController
}

export function App({ initialEditorController }: AppProps = {}): JSX.Element {
  const locale: Locale = 'zh-CN'
  const mainRef = useRef<HTMLElement>(null)
  const sidebarRef = useRef<HTMLElement>(null)
  const [editorController, setEditorController] = useState(
    () =>
      initialEditorController ??
      new CodeMirrorDocumentController(createUntitledDocumentSession(crypto.randomUUID()))
  )
  const [pendingTransition, setPendingTransition] = useState<DocumentTransition | null>(null)
  const [isSavingTransition, setIsSavingTransition] = useState(false)
  const [searchMode, setSearchMode] = useState<'find' | 'replace' | null>(null)
  const [recoveryRecords, setRecoveryRecords] = useState<readonly RecoveryRecord[]>([])
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false)
  const [recoveryError, setRecoveryError] = useState<string | null>(null)
  const [fileConflict, setFileConflict] = useState<FileConflict | null>(null)
  const [showFileConflict, setShowFileConflict] = useState(false)
  const [readOnlyDocument, setReadOnlyDocument] = useState<Extract<
    OpenedFile,
    { readonly accessMode: 'read-only' }
  > | null>(null)
  useSyncExternalStore(
    editorController.subscribe,
    editorController.getSnapshot,
    editorController.getSnapshot
  )
  const isSessionDirty =
    editorController.session.currentContentRevision !== editorController.session.savedRevision
  const canUndo = editorController.canUndo()
  const canRedo = editorController.canRedo()
  const desktopApi = useMemo(() => window.lattice, [])
  const discardRecovery = useCallback(
    async (documentId: string): Promise<void> => {
      try {
        const result = await desktopApi.recovery.discard(documentId)
        if (!result.ok) setRecoveryError(translate(locale, 'recovery.cleanupFailed'))
      } catch {
        setRecoveryError(translate(locale, 'recovery.cleanupFailed'))
      }
    },
    [desktopApi]
  )
  const writeRecovery = useCallback(
    async (trigger: RecoverySnapshot['trigger']): Promise<boolean> => {
      try {
        const result = await desktopApi.recovery.write(
          editorController.createRecoverySnapshot(trigger)
        )
        if (!result.ok) {
          setRecoveryError(translate(locale, 'errors.recovery.writeFailed'))
          return false
        }
        setRecoveryError(null)
        return true
      } catch {
        setRecoveryError(translate(locale, 'errors.recovery.writeFailed'))
        return false
      }
    },
    [desktopApi, editorController]
  )
  useEffect(() => {
    let active = true
    void desktopApi.recovery
      .list()
      .then((result) => {
        if (!active || !result.ok || result.value.length === 0) return
        setRecoveryRecords(result.value)
        setShowRecoveryDialog(true)
      })
      .catch(() => {
        if (active) setRecoveryError(translate(locale, 'recovery.readFailed'))
      })
    return () => {
      active = false
    }
  }, [desktopApi])
  const replaceWithUntitled = useCallback((): void => {
    setReadOnlyDocument(null)
    setEditorController(
      new CodeMirrorDocumentController(createUntitledDocumentSession(crypto.randomUUID()))
    )
  }, [])
  const performOpen = useCallback(async (): Promise<void> => {
    const result = await desktopApi.files.open()
    if (!result.ok || result.value === null) return
    if (result.value.accessMode === 'read-only') {
      setReadOnlyDocument(result.value)
      return
    }
    setReadOnlyDocument(null)
    setEditorController(new CodeMirrorDocumentController(sessionFromOpenedFile(result.value)))
  }, [desktopApi])
  const acceptSaveOutcome = useCallback(
    async (outcome: FileSaveOutcome): Promise<boolean> => {
      if (outcome.status === 'conflict') {
        setFileConflict(outcome)
        setShowFileConflict(true)
        return false
      }
      const accepted = editorController.acceptSavedFile(outcome.file)
      if (accepted) {
        await discardRecovery(editorController.session.id)
        setFileConflict(null)
        setShowFileConflict(false)
      }
      return accepted
    },
    [discardRecovery, editorController]
  )
  const saveDocumentAs = useCallback(async (): Promise<boolean> => {
    const result = await desktopApi.files.saveAs(editorController.createSaveSnapshot())
    if (!result.ok || result.value === null) return false
    return acceptSaveOutcome(result.value)
  }, [acceptSaveOutcome, desktopApi, editorController])
  const saveDocument = useCallback(async (): Promise<boolean> => {
    const session = editorController.session
    if (session.path === null || session.diskVersion === null) {
      return saveDocumentAs()
    }
    const result = await desktopApi.files.save({
      ...editorController.createSaveSnapshot(),
      path: session.path,
      expectedDiskVersion: session.diskVersion
    })
    if (!result.ok) return false
    return acceptSaveOutcome(result.value)
  }, [acceptSaveOutcome, desktopApi, editorController, saveDocumentAs])
  useEffect(() => {
    let observedRevision = editorController.session.revision
    let timer: number | undefined
    const unsubscribe = editorController.subscribe(() => {
      if (observedRevision === editorController.session.revision) return
      observedRevision = editorController.session.revision
      if (timer !== undefined) window.clearTimeout(timer)
      if (
        editorController.session.currentContentRevision === editorController.session.savedRevision
      ) {
        return
      }
      timer = window.setTimeout(() => {
        void (async () => {
          if (!(await writeRecovery('typing'))) return
          const session = editorController.session
          if (session.path !== null && session.diskVersion !== null && fileConflict === null) {
            await saveDocument()
          }
        })()
      }, 1_000)
    })
    return () => {
      if (timer !== undefined) window.clearTimeout(timer)
      unsubscribe()
    }
  }, [editorController, fileConflict, saveDocument, writeRecovery])
  useEffect(
    () =>
      desktopApi.files.onExternalChange((event) => {
        void (async () => {
          const session = editorController.session
          if (event.documentId !== session.id || event.path !== session.path) return
          if (event.kind === 'deleted') {
            setRecoveryError(translate(locale, 'external.deleted'))
            return
          }
          const isDirty = session.currentContentRevision !== session.savedRevision
          if (isDirty) {
            await saveDocument()
            return
          }
          if (event.external.accessMode !== 'editable') {
            setRecoveryError(translate(locale, 'external.unsupportedEncoding'))
            return
          }
          const result = await desktopApi.files.reloadExternal({
            documentId: session.id,
            path: event.path,
            expectedDiskVersion: event.external.diskVersion
          })
          if (!result.ok) {
            setRecoveryError(translate(locale, 'external.reloadFailed'))
            return
          }
          setEditorController(
            new CodeMirrorDocumentController(sessionFromReloadedFile(result.value))
          )
          setRecoveryError(null)
        })()
      }),
    [desktopApi, editorController, saveDocument]
  )
  const performTransition = useCallback(
    async (transition: DocumentTransition): Promise<void> => {
      if (transition === 'open') {
        await performOpen()
      } else if (transition === 'window-close') {
        await desktopApi.app.confirmClose('close')
      } else {
        replaceWithUntitled()
      }
    },
    [desktopApi, performOpen, replaceWithUntitled]
  )
  const requestTransition = useCallback(
    async (transition: DocumentTransition): Promise<void> => {
      const isDirty =
        editorController.session.currentContentRevision !== editorController.session.savedRevision
      if (isDirty) {
        await writeRecovery('close')
        setPendingTransition(transition)
        return
      }
      await performTransition(transition)
    },
    [editorController, performTransition, writeRecovery]
  )
  useEffect(
    () => desktopApi.app.onCloseRequested(() => void requestTransition('window-close')),
    [desktopApi, requestTransition]
  )
  const saveThenTransition = useCallback(async (): Promise<void> => {
    if (pendingTransition === null) return
    setIsSavingTransition(true)
    try {
      if (!(await saveDocument())) return
      const transition = pendingTransition
      setPendingTransition(null)
      await performTransition(transition)
    } finally {
      setIsSavingTransition(false)
    }
  }, [pendingTransition, performTransition, saveDocument])
  const discardThenTransition = useCallback(async (): Promise<void> => {
    if (pendingTransition === null) return
    const transition = pendingTransition
    await discardRecovery(editorController.session.id)
    setPendingTransition(null)
    await performTransition(transition)
  }, [discardRecovery, editorController, pendingTransition, performTransition])
  const recoverDocument = useCallback((record: RecoveryRecord): void => {
    setEditorController(
      new CodeMirrorDocumentController(
        restoreDocumentSession({
          id: record.documentId,
          path: record.path,
          buffer: createSourceBufferFromText({
            text: record.text,
            encoding: record.encoding,
            eolByLine: record.eolByLine,
            originalBytesHash: record.originalBytesHash
          }),
          diskVersion: record.diskVersion,
          revision: record.revision,
          currentContentRevision: record.currentContentRevision,
          savedRevision: record.savedRevision
        })
      )
    )
    setShowRecoveryDialog(false)
  }, [])
  const discardRecoveryRecord = useCallback(
    async (record: RecoveryRecord): Promise<void> => {
      await discardRecovery(record.documentId)
      setRecoveryRecords((records) =>
        records.filter((candidate) => candidate.documentId !== record.documentId)
      )
    },
    [discardRecovery]
  )
  const cancelPendingTransition = useCallback(async (): Promise<void> => {
    if (pendingTransition === 'window-close') await desktopApi.app.confirmClose('cancel')
    setPendingTransition(null)
  }, [desktopApi, pendingTransition])
  const overwriteExternalFile = useCallback(async (): Promise<void> => {
    if (fileConflict === null) return
    const result = await desktopApi.files.confirmedOverwrite({
      ...editorController.createSaveSnapshot(),
      conflictToken: fileConflict.conflictToken
    })
    if (!result.ok) return
    await acceptSaveOutcome(result.value)
  }, [acceptSaveOutcome, desktopApi, editorController, fileConflict])
  const reloadExternalFile = useCallback(async (): Promise<void> => {
    if (fileConflict?.external.accessMode !== 'editable') return
    const external = fileConflict.external
    const session = editorController.session
    if (session.path === null) return
    const result = await desktopApi.files.reloadExternal({
      documentId: session.id,
      path: session.path,
      expectedDiskVersion: external.diskVersion
    })
    if (!result.ok) {
      setRecoveryError(translate(locale, 'external.reloadFailed'))
      return
    }
    await discardRecovery(session.id)
    setEditorController(new CodeMirrorDocumentController(sessionFromReloadedFile(result.value)))
    setFileConflict(null)
    setShowFileConflict(false)
    setRecoveryError(null)
  }, [desktopApi, discardRecovery, editorController, fileConflict])
  const documentBindings = useMemo<DocumentCommandBindings>(
    () => ({
      hasSession: true,
      isSessionDirty,
      isSessionReadOnly: readOnlyDocument !== null,
      hasEditor: readOnlyDocument === null,
      canUndo,
      canRedo,
      newDocument: () => requestTransition('new'),
      openDocument: () => requestTransition('open'),
      saveDocument: async () => {
        await saveDocument()
      },
      saveDocumentAs: async () => {
        await saveDocumentAs()
      },
      closeDocument: () => requestTransition('close'),
      undo: () => {
        editorController.undo()
      },
      redo: () => {
        editorController.redo()
      },
      openFind: () => setSearchMode('find'),
      openReplace: () => setSearchMode('replace')
    }),
    [
      editorController,
      isSessionDirty,
      canUndo,
      canRedo,
      readOnlyDocument,
      requestTransition,
      saveDocument,
      saveDocumentAs
    ]
  )
  const controller = useCommandController({ mainRef, sidebarRef, document: documentBindings })
  const documentName = displayName(locale, readOnlyDocument?.path ?? editorController.session.path)
  return (
    <>
      <AppShell
        locale={locale}
        controller={controller}
        editorController={editorController}
        readOnlyDocument={readOnlyDocument}
        documentName={documentName}
        mainRef={mainRef}
        sidebarRef={sidebarRef}
      />
      {searchMode !== null && (
        <FindReplacePanel
          locale={locale}
          mode={searchMode}
          controller={editorController}
          onClose={() => setSearchMode(null)}
        />
      )}
      {pendingTransition !== null && (
        <UnsavedChangesDialog
          locale={locale}
          documentName={documentName}
          isSaving={isSavingTransition}
          onSave={() => void saveThenTransition()}
          onDiscard={() => void discardThenTransition()}
          onCancel={() => void cancelPendingTransition()}
        />
      )}
      {showRecoveryDialog &&
        recoveryRecords.length > 0 &&
        pendingTransition === null &&
        !showFileConflict && (
          <RecoveryDialog
            locale={locale}
            records={recoveryRecords}
            onRecover={recoverDocument}
            onDiscard={(record) => void discardRecoveryRecord(record)}
            onClose={() => setShowRecoveryDialog(false)}
          />
        )}
      {recoveryError !== null && <p role="alert">{recoveryError}</p>}
      {fileConflict !== null && !showFileConflict && (
        <button type="button" className="conflict-banner" onClick={() => setShowFileConflict(true)}>
          {translate(locale, 'conflict.pending')}
        </button>
      )}
      {fileConflict !== null && showFileConflict && (
        <ExternalConflictDialog
          locale={locale}
          conflict={fileConflict}
          localText={editorController.session.buffer.text}
          onReload={() => void reloadExternalFile()}
          onSaveAs={() => void saveDocumentAs()}
          onOverwrite={() => void overwriteExternalFile()}
          onCancel={() => setShowFileConflict(false)}
        />
      )}
    </>
  )
}

function sessionFromOpenedFile(
  file: Extract<OpenedFile, { readonly accessMode: 'editable' }>
): DocumentSession {
  return createDocumentSession({
    id: file.documentId,
    path: file.path,
    buffer: createSourceBufferFromText({
      text: file.text,
      encoding: file.encoding,
      eolByLine: file.eolByLine,
      originalBytesHash: file.bytesHash
    }),
    diskVersion: file.diskVersion
  })
}

function sessionFromReloadedFile(file: ReloadedExternalFile): DocumentSession {
  return restoreDocumentSession({
    id: file.documentId,
    path: file.path,
    buffer: createSourceBufferFromText({
      text: file.text,
      encoding: file.encoding,
      eolByLine: file.eolByLine,
      originalBytesHash: file.bytesHash
    }),
    diskVersion: file.diskVersion,
    revision: file.revision,
    currentContentRevision: file.revision,
    savedRevision: file.revision
  })
}

function displayName(locale: Locale, path: string | null): string {
  return path?.split(/[\\/]/u).at(-1) ?? translate(locale, 'document.untitled')
}
