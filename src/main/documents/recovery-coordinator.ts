import type { DocumentSession } from '../../domain/documents'

export type RecoveryWriteTrigger = 'typing' | 'structural' | 'close'

interface PendingRecoveryWrite {
  readonly token: string
  readonly generation: number
}

export interface RecoveryCoordinatorDependencies {
  readonly writeSnapshot: (session: DocumentSession) => Promise<void>
  readonly schedule: (callback: () => void, delayMs: number) => string
  readonly cancelScheduled: (token: string) => void
  readonly reportWriteFailure?: (sessionId: string) => void
}

export interface RecoveryCoordinator {
  readonly record: (session: DocumentSession, trigger: RecoveryWriteTrigger) => Promise<void>
  readonly dispose: () => void
}

const TYPING_IDLE_DELAY_MS = 1_000

export function createRecoveryCoordinator(
  dependencies: RecoveryCoordinatorDependencies
): RecoveryCoordinator {
  const pendingBySession = new Map<string, PendingRecoveryWrite>()
  let generation = 0

  function cancelPending(sessionId: string): void {
    const pending = pendingBySession.get(sessionId)
    if (pending === undefined) return
    pendingBySession.delete(sessionId)
    dependencies.cancelScheduled(pending.token)
  }

  return {
    record: async (session, trigger) => {
      cancelPending(session.id)
      if (trigger !== 'typing') {
        await dependencies.writeSnapshot(session)
        return
      }

      generation += 1
      const scheduledGeneration = generation
      const token = dependencies.schedule(() => {
        const pending = pendingBySession.get(session.id)
        if (pending?.generation !== scheduledGeneration) return
        pendingBySession.delete(session.id)
        void dependencies.writeSnapshot(session).catch(() => {
          safelyReportFailure(dependencies, session.id)
        })
      }, TYPING_IDLE_DELAY_MS)
      pendingBySession.set(session.id, { token, generation: scheduledGeneration })
    },
    dispose: () => {
      for (const pending of pendingBySession.values()) {
        dependencies.cancelScheduled(pending.token)
      }
      pendingBySession.clear()
    }
  }
}

function safelyReportFailure(
  dependencies: RecoveryCoordinatorDependencies,
  sessionId: string
): void {
  try {
    dependencies.reportWriteFailure?.(sessionId)
  } catch {
    return
  }
}
