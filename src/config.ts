export const CONFIG = {
  extensionId: 'git-branch-files',
  synchronizationFrequency: 10_000,
  synchronizationDelayAfterBranchChange: 30_000,
  /** If true, doesn't close pinned tabs while switching branches */
  protectPinnedTabs: true,
} as const
