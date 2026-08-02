import type {
  AppCommand,
  CommandContext,
  CommandExecutionContext,
  CommandResult,
  CommandState
} from './command-types'

export class CommandRegistry {
  private readonly commands = new Map<string, AppCommand>()

  constructor(commands: readonly AppCommand[]) {
    for (const command of commands) {
      if (this.commands.has(command.id)) {
        throw new Error(`Duplicate command ID: ${command.id}`)
      }
      this.commands.set(command.id, command)
    }
  }

  getStates(context: CommandContext): readonly CommandState[] {
    const states = [...this.commands.values()]
      .map((command) => Object.freeze({ ...command.getState(context) }))
      .sort((left, right) => left.id.localeCompare(right.id))
    return Object.freeze(states)
  }

  async execute(id: string, context: CommandExecutionContext): Promise<CommandResult> {
    const command = this.commands.get(id)
    if (command === undefined) return { status: 'not-found', id }

    const state = command.getState(context)
    if (!state.isVisible) return { status: 'not-visible', id: command.id }
    if (!state.isEnabled) return { status: 'disabled', id: command.id }

    try {
      return await command.run(context)
    } catch {
      return {
        status: 'failed',
        id: command.id,
        messageKey: 'errors.internal.unexpected'
      }
    }
  }
}
