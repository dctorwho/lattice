import {
  IPC_CONTRACT_VERSION,
  RECOVERY_DISCARD_CHANNEL,
  RECOVERY_LIST_CHANNEL,
  RECOVERY_WRITE_CHANNEL,
  recoveryDiscardResultSchema,
  recoveryListResultSchema,
  recoveryWriteResultSchema,
  requestIdSchema,
  type ApprovedIpcChannel,
  type LatticeDesktopApi
} from '../../shared/contracts'

export interface RecoveryApiDependencies {
  readonly createRequestId: () => string
  readonly invoke: (channel: ApprovedIpcChannel, request: unknown) => Promise<unknown>
}

export function createRecoveryApi(
  dependencies: RecoveryApiDependencies
): LatticeDesktopApi['recovery'] {
  async function invokeValidated<T>(
    channel: ApprovedIpcChannel,
    payload: unknown,
    schema: { readonly safeParse: (value: unknown) => { success: boolean; data?: T } }
  ): Promise<T> {
    const candidate = dependencies.createRequestId()
    const parsedId = requestIdSchema.parse(candidate)
    const response = await dependencies.invoke(channel, {
      contractVersion: IPC_CONTRACT_VERSION,
      requestId: parsedId,
      payload
    })
    const parsed = schema.safeParse(response)
    if (!parsed.success || parsed.data === undefined) {
      throw new Error('Recovery IPC response failed validation')
    }
    return parsed.data
  }

  return {
    write: (snapshot) =>
      invokeValidated(RECOVERY_WRITE_CHANNEL, snapshot, recoveryWriteResultSchema),
    list: () => invokeValidated(RECOVERY_LIST_CHANNEL, {}, recoveryListResultSchema),
    discard: (documentId) =>
      invokeValidated(RECOVERY_DISCARD_CHANNEL, { documentId }, recoveryDiscardResultSchema)
  }
}
