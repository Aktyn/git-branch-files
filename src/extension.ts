import { type ExtensionContext } from 'vscode'
import { CONFIG } from './config'
import { GitAPI } from './core/gitAPI'
import { getOpenFiles } from './core/helpers'
import { logger } from './logger'
import { Synchronizer } from './core/synchronizer'

export function activate(context: ExtensionContext) {
  logger.appendLine(`Extension "${CONFIG.extensionId}" is now active!`)

  try {
    logger.appendLine(
      `Open files ${JSON.stringify(
        getOpenFiles().map((openFile) => openFile.label),
        null,
        2,
      )}`,
    )

    const synchronizer = new Synchronizer(context)
    const git = new GitAPI(context, {
      onFilesRestoreRequest: (repository) => {
        logger.appendLine(`Restore files for branch: ${repository.activeBranch}`)

        synchronizer.restoreFiles(repository)
      },
    })

    if (git.initialized) {
      context.subscriptions.push(
        synchronizer.startSynchronization(() => git.getActiveRepositories()),
      )
    }
  } catch (error) {
    logger.appendLine(`Error ${error}`)
  }
}

export function deactivate() {
  logger.appendLine(`Extension "${CONFIG.extensionId}" is not longer active!`)
}
