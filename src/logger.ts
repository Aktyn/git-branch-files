import { window } from 'vscode'

export const logger = window.createOutputChannel('Git Branch Files')

export function logError(error: unknown) {
  logger.appendLine(`Error: ${error instanceof Error ? error.message : String(error)}`)
}
