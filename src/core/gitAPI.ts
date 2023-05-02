import type { Uri } from 'vscode'
import { type ExtensionContext, extensions } from 'vscode'
import type { GitExtension, Repository } from '../typings/git'
import { logger } from '../logger'

export interface RepositorySchema {
  uri: Uri
  activeBranch?: string
}

export class GitAPI {
  private readonly activeRepositories = new Map<Uri['path'], RepositorySchema>()
  public readonly initialized: boolean = false

  constructor(
    private readonly context: ExtensionContext,
    private readonly listeners: { onFilesRestoreRequest: (repository: RepositorySchema) => void },
  ) {
    const gitExtension = extensions.getExtension<GitExtension>('vscode.git')?.exports
    const gitApi = gitExtension?.getAPI(1)

    if (!gitApi) {
      logger.appendLine(`No git API available`)
      return
    }

    for (const repo of gitApi.repositories) {
      this.registerRepository(repo)
    }

    this.context.subscriptions.push(
      gitApi.onDidOpenRepository((repo) => {
        logger.appendLine(`Repository opened: ${repo.rootUri}`)
        this.registerRepository(repo)
      }),
    )
    this.context.subscriptions.push(
      gitApi.onDidCloseRepository((repo) => {
        logger.appendLine(`Repository closed: ${repo.rootUri}`)
        this.unregisterRepository(repo)
      }),
    )

    this.initialized = true
  }

  getActiveRepositories() {
    return Array.from(this.activeRepositories.values())
  }

  private registerRepository(repository: Repository) {
    logger.appendLine(
      `Repository registered: ${repository.rootUri}; branch: ${repository.state.HEAD?.name}`,
    )

    this.activeRepositories.set(repository.rootUri.path, {
      uri: repository.rootUri,
      activeBranch: repository.state.HEAD?.name,
    })

    this.context.subscriptions.push(
      repository.state.onDidChange(() => {
        const branchName = repository.state.HEAD?.name

        const activeRepository = this.activeRepositories.get(repository.rootUri.path)
        if (!activeRepository || activeRepository.activeBranch === branchName) {
          return
        }

        const updatedRepository = { ...activeRepository, activeBranch: branchName }

        this.activeRepositories.set(repository.rootUri.path, updatedRepository)
        logger.appendLine(
          `Repository branch changed from "${activeRepository.activeBranch}" to "${branchName}"`,
        )

        this.listeners.onFilesRestoreRequest(updatedRepository)
      }),
    )
  }

  private unregisterRepository(repository: Repository) {
    return this.activeRepositories.delete(repository.rootUri.path)
  }
}
