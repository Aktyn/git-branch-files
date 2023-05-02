# Git branch files

This extension adds to vscode a feature that automatically synchronizes the list of open files according to the current git branch.
This feature is built-in in other IDEs like IntelliJ.

#### Simplified example
1. User is working on branch `branch-1` with the following files open: `a.txt` and `b.txt`.
2. User switches to new branch `branch-2` and closes file `b.txt`, leaving only `a.txt` open.
3. After switching back to `branch-1`, the `b.txt` file is opened again, so the list of open files will be again: `a.txt` and `b.txt`.

## Features
- Automatically restore the list of open files when switching back to a branch
- Pinned files are not closed when switching branches
- Extension automatically restores focus to the file that was active before leaving the branch
- Switching to a new branch does not change the list of open files

---

## Release Notes
### 1.0.0
- Initial release