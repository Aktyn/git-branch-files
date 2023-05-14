import * as path from 'path'
import type { Tab, TextDocument } from 'vscode'
import { window, workspace } from 'vscode'
import { CONFIG } from '../config'
import { logError, logger } from '../logger'
import type { ExtendArray } from '../utils'
import { forceArray } from '../utils'
import { DisposableInterval } from './disposableInterval'
import type { RepositorySchema } from './gitAPI'
import { getOpenFiles, hasUri } from './helpers'
import { WorkspaceState } from './workspaceState'

export class Synchronizer extends WorkspaceState {
  private intervals = new Set<DisposableInterval>()
  private restoring = false
  private syncQueue: RepositorySchema[] = []
  private synchronizationTimeout: ReturnType<typeof setTimeout> | null = null

  async restoreFiles(repository: RepositorySchema) {
    const state = super.getState()

    if (
      !repository.activeBranch ||
      !(repository.uri.path in state) ||
      !(repository.activeBranch in state[repository.uri.path])
    ) {
      return
    }

    this.restoring = true

    const branchState = state[repository.uri.path][repository.activeBranch]
    if (branchState?.files) {
      logger.appendLine('Closing all open files...')
      const { pinnedTabs } = await this.closeAllOpenFiles(CONFIG.protectPinnedTabs)
      logger.appendLine('...closed all open files')

      const filesToRestore = branchState.files.filter((file) => {
        const isPinned = pinnedTabs.some((pinned) => {
          const uri = hasUri(pinned.input) ? pinned.input.uri : null
          return uri && uri.path === file.path
        })
        if (isPinned) {
          return false
        }

        return true
      })

      try {
        let documentToFocus: TextDocument | null = null
        for (const file of filesToRestore) {
          try {
            logger.appendLine(`Restoring file: "${path.relative(repository.uri.path, file.path)}"`)
            const document = await workspace.openTextDocument(file.path)
            await window.showTextDocument(document, {
              preview: false,
              preserveFocus: true,
            })

            if (file.isActive) {
              documentToFocus = document
            }
          } catch (error) {
            logError(error)
          }
        }

        if (documentToFocus) {
          logger.appendLine(
            `Activating file: "${path.relative(repository.uri.path, documentToFocus.uri.path)}"`,
          )
          await window.showTextDocument(documentToFocus, {
            preview: false,
            preserveFocus: false,
          })
        }
      } catch (error) {
        logError(error)
      }

      logger.appendLine(
        `Restored ${filesToRestore.length} files for branch: "${
          repository.activeBranch
        }" in repository: "${repository.uri.path}"\n(${filesToRestore
          .map((file) => path.relative(repository.uri.path, file.path))
          .join(', ')})`,
      )

      for (const interval of this.intervals) {
        if (interval.disposed) {
          this.intervals.delete(interval)
        } else {
          interval.delayNextCall(CONFIG.synchronizationDelayAfterBranchChange)
        }
      }
    }

    this.restoring = false

    if (this.syncQueue.length) {
      this.synchronize([...this.syncQueue])
      this.syncQueue = []
    }
  }

  /** Debounced */
  synchronize(activeRepositories: RepositorySchema[]) {
    if (this.synchronizationTimeout) {
      clearTimeout(this.synchronizationTimeout)
    }

    this.synchronizationTimeout = setTimeout(async () => {
      this.synchronizationTimeout = null

      if (this.restoring) {
        for (const repo of activeRepositories) {
          if (!this.syncQueue.some((repoToSync) => repoToSync.uri.path === repo.uri.path)) {
            this.syncQueue.push(repo)
          }
        }
        return
      }
      for (const repository of activeRepositories) {
        if (!repository.activeBranch) {
          continue
        }

        const openFiles = getOpenFiles()

        logger.appendLine(`Saving open files state for branch: "${repository.activeBranch}"...`)
        await super.updateState(repository, {
          files: openFiles,
        })
        logger.appendLine(`...saved ${openFiles.length} files`)
      }
    }, 1000)
  }

  startSynchronization(fetchActiveRepository: () => ExtendArray<RepositorySchema>) {
    const interval = new DisposableInterval(
      () => this.synchronize(forceArray(fetchActiveRepository())),
      CONFIG.synchronizationFrequency,
    )

    this.intervals.add(interval)
    return interval
  }

  private async closeAllOpenFiles(protectPinned = false) {
    const pinnedTabs: Tab[] = []
    const tabsToClose: Tab[] = []

    for (const tabGroup of window.tabGroups.all) {
      for (const tab of tabGroup.tabs) {
        if (tab.isPinned && protectPinned) {
          pinnedTabs.push(tab)
          continue
        }
        tabsToClose.push(tab)
      }
    }

    try {
      await window.tabGroups.close(tabsToClose)
    } catch (error) {
      logError(error)
      logger.appendLine('Trying to close files one by one...')

      for (const tab of tabsToClose) {
        try {
          await window.tabGroups.close(tab)
        } catch (error) {
          logError(error)
        }
      }
    }

    return { pinnedTabs }
  }
}
