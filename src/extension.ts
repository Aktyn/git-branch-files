import { extensions, type ExtensionContext } from 'vscode'
import { CONFIG } from './config'
import { getOpenFiles } from './core/helpers'
import { logger } from './logger'

export function activate(_context: ExtensionContext) {
  logger.appendLine(`Extension "${CONFIG.extensionId}" is now active!`)

  try {
    logger.appendLine(
      `Open files ${JSON.stringify(
        getOpenFiles().map((openFile) => openFile.label),
        null,
        2,
      )}`,
    )

    const gitExtension = extensions.getExtension('vscode.git')?.exports
    const gitApi = gitExtension.getAPI(1)
    for (const name in gitApi.git) {
      logger.appendLine(`Test: ${name}, ${!!gitApi.onDidChangeState}`)
    }
    gitApi.onDidChangeState((state: any) => {
      try {
        logger.appendLine(`State: ${JSON.stringify(state, null, 2)}`)
        if (state.branch) {
          const branchName = state.branch.name
          // Do something with the branch name...

          logger.appendLine(`Branch name: ${branchName}`)
        }
      } catch (error) {
        logger.appendLine(`Error ${error}`)
      }
    })
  } catch (error) {
    logger.appendLine(`Error ${error}`)
  }
}

export function deactivate() {
  logger.appendLine(`Extension "${CONFIG.extensionId}" is not longer active!`)
}
