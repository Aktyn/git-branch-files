import type { ExtensionContext, Uri } from 'vscode'
import type { OpenFileSchema } from './helpers'
import type { RepositorySchema } from './gitAPI'

interface WorkspaceStateSchema {
  [repositoryPath: Uri['path']]: {
    [branchName: string]: {
      files: OpenFileSchema[]
    }
  }
}

export class WorkspaceState {
  constructor(protected readonly context: ExtensionContext) {}

  getState(): WorkspaceStateSchema {
    return this.context.workspaceState.get('gitBranchFiles', {})
  }

  updateState(
    repository: RepositorySchema,
    branchState: WorkspaceStateSchema[Uri['path']][string],
  ) {
    if (!repository.activeBranch) {
      return
    }

    const currentState = this.getState()
    return this.context.workspaceState.update('gitBranchFiles', {
      ...currentState,
      [repository.uri.path]: {
        ...currentState[repository.uri.path],
        [repository.activeBranch]: branchState,
      },
    })
  }
}
