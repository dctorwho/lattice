import { type ApprovedIpcChannel } from '../../shared/contracts'
import { type ErrorCode, type IpcSafeReason } from '../../shared/errors'

const MAX_SAFE_STACK_FRAMES = 8
const MAX_SAFE_STACK_FRAME_LENGTH = 256

export interface IpcErrorLogEvent {
  readonly level: 'warning' | 'error'
  readonly code: ErrorCode
  readonly requestId: string
  readonly channel: ApprovedIpcChannel | 'unknown'
  readonly reason: IpcSafeReason
  readonly windowId?: number
  readonly webContentsId?: number
  readonly safeStack?: readonly string[]
}

export interface IpcConsoleAdapter {
  readonly warn: (label: 'lattice.ipc', event: IpcErrorLogEvent) => void
  readonly error: (label: 'lattice.ipc', event: IpcErrorLogEvent) => void
}

export function createConsoleIpcErrorLogSink(
  adapter: IpcConsoleAdapter
): (event: IpcErrorLogEvent) => void {
  return (event) => {
    if (event.level === 'warning') {
      adapter.warn('lattice.ipc', event)
      return
    }

    adapter.error('lattice.ipc', event)
  }
}

function errorStack(value: unknown): string | undefined {
  try {
    if (!(value instanceof Error)) {
      return undefined
    }

    const stack: unknown = value.stack
    return typeof stack === 'string' ? stack : undefined
  } catch {
    return undefined
  }
}

export function createSafeStack(value: unknown): readonly string[] | undefined {
  const stack = errorStack(value)
  if (stack === undefined) {
    return undefined
  }

  const frames: string[] = []
  const append = (frame: string): boolean => {
    if (frame.length > MAX_SAFE_STACK_FRAME_LENGTH || frame.includes('\\') || frame.includes('/')) {
      return false
    }

    frames.push(frame)
    return frames.length === MAX_SAFE_STACK_FRAMES
  }

  for (const line of stack.split('\n')) {
    const nodeFrame =
      /^\s*at process\.processTicksAndRejections \(node:internal\/process\/task_queues:(\d+):(\d+)\)\s*$/u.exec(
        line
      )
    if (nodeFrame !== null) {
      if (append(`processTicksAndRejections (task_queues:${nodeFrame[1]}:${nodeFrame[2]})`)) {
        break
      }
      continue
    }

    const applicationFrame =
      /^\s*at ([A-Za-z_$][\w.$]*) \((?:.*[\\/])?([^\\/():]+\.(?:js|cjs|mjs|ts|tsx)):(\d+):(\d+)\)\s*$/u.exec(
        line
      )
    if (applicationFrame === null) {
      continue
    }

    if (
      append(
        `${applicationFrame[1]} (${applicationFrame[2]}:${applicationFrame[3]}:${applicationFrame[4]})`
      )
    ) {
      break
    }
  }

  return frames.length === 0 ? undefined : frames
}
