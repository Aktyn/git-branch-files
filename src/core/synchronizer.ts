import * as path from 'path'
import type { Tab } from 'vscode'
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
        const openedDocuments = await Promise.all(
          filesToRestore.map((file) => {
            logger.appendLine(`Restoring file: "${path.relative(repository.uri.path, file.path)}"`)
            return workspace.openTextDocument(file.path).then((document) => ({ document, file }))
          }),
        )

        for (const { document } of openedDocuments) {
          //TODO: pin document if it was pinned on branch of origin
          await window.showTextDocument(document, {
            preview: false,
            preserveFocus: true,
          })
        }

        const active = openedDocuments.find(({ file }) => file.isActive)
        if (active) {
          logger.appendLine(
            `Activating file: "${path.relative(repository.uri.path, active.file.path)}"`,
          )
          await window.showTextDocument(active.document, {
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
        logger.appendLine(`Saving open files state for branch: "${repository.activeBranch}"`)

        await super.updateState(repository, {
          files: getOpenFiles(),
        })
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
    for (const tabGroup of window.tabGroups.all) {
      for (const tab of tabGroup.tabs) {
        if (tab.isPinned && protectPinned) {
          pinnedTabs.push(tab)
          continue
        }

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
