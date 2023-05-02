import { workspace, type ExtensionContext } from 'vscode'
import { CONFIG } from './config'
import { GitAPI } from './core/gitAPI'
import { Synchronizer } from './core/synchronizer'
import { logError, logger } from './logger'

export function activate(context: ExtensionContext) {
  logger.appendLine(`Extension "${CONFIG.extensionId}" is now active!`)

  try {
    const synchronizer = new Synchronizer(context)
    const git = new GitAPI(context, {
      onFilesRestoreRequest: (repository) => {
        logger.appendLine(`Restore files for branch: ${repository.activeBranch}`)

        synchronizer.restoreFiles(repository).catch((error) => logError(error))
      },
    })

    if (git.initialized) {
      context.subscriptions.push(
        synchronizer.startSynchronization(() => git.getActiveRepositories()),
      )

      workspace.onDidOpenTextDocument((document) => {
        if (document.uri.scheme !== 'file') {
          return
        }
        synchronizer.synchronize(git.getActiveRepositories())
      })

      workspace.onDidCloseTextDocument((document) => {
        if (document.uri.scheme !== 'file') {
          return
        }
        synchronizer.synchronize(git.getActiveRepositories())
      })
    }
  } catch (error) {
    logError(error)
  }
}

export function deactivate() {
  logger.appendLine(`Extension "${CONFIG.extensionId}" is not longer active!`)
}
