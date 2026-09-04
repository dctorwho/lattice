import type { AppError, Result } from '../errors'
import type { AppInfo } from './app-info'
import type { CommandId, CommandState, CommandStateSync } from './command'
import type { FilesOpenResult } from './file-open'
import type {
  DocumentSaveSnapshot,
  FilesConfirmedOverwriteResult,
  FilesSaveAsResult,
  FilesSaveRequest,
  FilesSaveResult
} from './file-save'
import type {
  FilesExternalChangeEvent,
  FilesReloadExternalRequest,
  FilesReloadExternalResult
} from './file-watch'
import type {
  RecoveryDiscardResult,
  RecoveryListResult,
  RecoverySnapshot,
  RecoveryWriteResult
} from './recovery'
import type { WindowCloseDecisionResult } from './window-lifecycle'

export interface LatticeDesktopApi {
  readonly app: {
    readonly getInfo: () => Promise<Result<AppInfo, AppError>>
    readonly onCloseRequested: (listener: () => void) => () => void
    readonly confirmClose: (decision: 'close' | 'cancel') => Promise<WindowCloseDecisionResult>
  }
  readonly commands: {
    readonly onInvoke: (listener: (id: CommandId) => void) => () => void
    readonly updateStates: (
      states: readonly CommandState[]
    ) => Promise<Result<CommandStateSync, AppError>>
  }
  readonly files: {
    readonly open: () => Promise<FilesOpenResult>
    readonly save: (request: FilesSaveRequest['payload']) => Promise<FilesSaveResult>
    readonly saveAs: (request: DocumentSaveSnapshot) => Promise<FilesSaveAsResult>
    readonly confirmedOverwrite: (
      request: DocumentSaveSnapshot & { readonly conflictToken: string }
    ) => Promise<FilesConfirmedOverwriteResult>
    readonly reloadExternal: (
      request: FilesReloadExternalRequest['payload']
    ) => Promise<FilesReloadExternalResult>
    readonly onExternalChange: (listener: (event: FilesExternalChangeEvent) => void) => () => void
  }
  readonly recovery: {
    readonly write: (snapshot: RecoverySnapshot) => Promise<RecoveryWriteResult>
    readonly list: () => Promise<RecoveryListResult>
    readonly discard: (documentId: string) => Promise<RecoveryDiscardResult>
  }
}
