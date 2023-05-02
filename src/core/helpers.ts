import { Uri, window } from 'vscode'

export interface OpenFileSchema {
  path: Uri['path']
  label: string
  isActive: boolean
  isPinned: boolean
}

export function getOpenFiles() {
  return window.tabGroups.all.reduce((acc, group) => {
    for (const tab of group.tabs) {
      const uri = hasUri(tab.input) ? tab.input.uri : null

      if (!uri || uri.scheme !== 'file' || acc.some((file) => file.path === uri.path)) {
        continue
      }

      acc.push({
        path: uri.path,
        label: tab.label,
        isActive: tab.isActive,
        isPinned: tab.isPinned,
      })
    }
    return acc
  }, [] as OpenFileSchema[])
}

export function hasUri(input: unknown): input is { uri: Uri } {
  return (input as { uri: Uri })?.uri instanceof Uri
}
