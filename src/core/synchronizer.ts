import { CONFIG } from '../config'
import { logger } from '../logger'
import type { ExtendArray } from '../utils'
import { forceArray } from '../utils'
import { DisposableInterval } from './disposableInterval'
import type { RepositorySchema } from './gitAPI'
import { WorkspaceState } from './workspaceState'

export class Synchronizer extends WorkspaceState {
  private intervals = new Set<DisposableInterval>()

  restoreFiles(repository: RepositorySchema) {
    const state = super.getState()

    if (
      !repository.activeBranch ||
      !(repository.uri.path in state) ||
      !(repository.activeBranch in state[repository.uri.path])
    ) {
      return
    }

    const branchState = state[repository.uri.path][repository.activeBranch]
    if (branchState?.files) {
      //TODO: replace current open files with branchState.files

      logger.appendLine(
        `Restored ${branchState.files.length} files for branch: "${repository.activeBranch}"`,
      )

      for (const interval of this.intervals) {
        if (interval.disposed) {
          this.intervals.delete(interval)
        } else {
          interval.delayNextCall(CONFIG.synchronizationDelayAfterBranchChange)
        }
      }
    }
  }

  startSynchronization(fetchActiveRepository: () => ExtendArray<RepositorySchema>) {
    const interval = new DisposableInterval(async () => {
      const activeRepositories = forceArray(fetchActiveRepository())

      for (const repository of activeRepositories) {
        if (!repository.activeBranch) {
          continue
        }
        logger.appendLine(`Synchronizing files for branch: "${repository.activeBranch}"`)

        await super.updateState(repository, {
          files: [], //TODO: load list of currently opened files
        })
      }
    }, CONFIG.synchronizationFrequency)

    this.intervals.add(interval)
    return interval
  }
}
